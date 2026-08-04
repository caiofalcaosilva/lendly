import io
import math
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from mongoengine import Q
from PIL import Image

from app.config import settings
from app.models.group import Group
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemOwnerResponse, ItemResponse, ItemUpdate
from app.services import category_service, email_service

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_DIMENSION = 1600


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _to_response(item: Item, current_user: Optional[User] = None) -> ItemResponse:
    owner = item.owner
    is_favorited = False
    if current_user and current_user.favorites:
        is_favorited = any(str(f.id) == str(item.id) for f in current_user.favorites)
    is_waitlisted = False
    if current_user and item.waitlist:
        is_waitlisted = any(str(u.id) == str(current_user.id) for u in item.waitlist)
    return ItemResponse(
        id=str(item.id),
        owner=ItemOwnerResponse(
            id=str(owner.id),
            name=owner.name,
            neighborhood=owner.neighborhood,
            city=owner.city,
            average_rating=owner.average_rating,
            reliability_score=owner.reliability_score,
            reliability_count=owner.reliability_count or 0,
            account_type=owner.account_type or "individual",
            trade_name=owner.trade_name,
        ),
        title=item.title,
        description=item.description,
        category=item.category,
        subcategory=item.subcategory,
        photos=item.photos or [],
        availability_type=item.availability_type,
        daily_rate=item.daily_rate,
        usage_rules=item.usage_rules,
        zip_code=item.zip_code,
        neighborhood=item.neighborhood,
        city=item.city,
        state=item.state,
        latitude=item.latitude,
        longitude=item.longitude,
        is_available=item.is_available,
        is_active=item.is_active,
        is_favorited=is_favorited,
        is_waitlisted=is_waitlisted,
        is_public=item.is_public,
        groups=[str(g.id) for g in item.groups],
        available_days=item.available_days or [],
        requires_identity_verification=item.requires_identity_verification or False,
        created_at=item.created_at,
    )


def _resolve_member_groups(group_ids: List[str], current_user: User) -> List[Group]:
    """Fetches the given groups, raising 403 if current_user isn't a member
    of any of them — you can only tag an item into a group you're in."""
    groups = []
    for group_id in group_ids:
        group = Group.objects(id=group_id).first()
        if not group or not any(str(m.id) == str(current_user.id) for m in group.members):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not a member of group '{group_id}'",
            )
        groups.append(group)
    return groups


def _assert_visible(is_public: bool, groups: list) -> None:
    if not is_public and not groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item must be public or belong to at least one group",
        )


def _get_owned_item(item_id: str, current_user: User) -> Item:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if str(item.owner.id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner")
    return item


def _validate_category(category: str, subcategory: Optional[str]) -> None:
    if not category_service.is_valid_category(category):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid category '{category}'")
    if subcategory and not category_service.is_valid_subcategory(category, subcategory):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid subcategory '{subcategory}' for category '{category}'",
        )


def create_item(data: ItemCreate, current_user: User) -> ItemResponse:
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contas administrativas não podem cadastrar itens",
        )

    if data.availability_type.value == "paid" and not data.daily_rate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid items must have a daily_rate greater than 0",
        )

    if data.availability_type.value == "paid" and not current_user.mp_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conecte sua conta Mercado Pago antes de anunciar um item pago. Faça isso em /profile.",
        )

    _validate_category(data.category, data.subcategory)

    groups = _resolve_member_groups(data.group_ids or [], current_user)
    _assert_visible(data.is_public, groups)

    # Only fall back to the owner's own address when NO address was given
    # at all — if the caller provided a custom neighborhood/city/zip (e.g.
    # geocoding just didn't return coordinates for that CEP), latitude/
    # longitude must never silently default to the owner's own location,
    # or the item ends up with a mismatched address (right city in text,
    # wrong coordinates on the map).
    using_owner_address = not any([data.zip_code, data.neighborhood, data.city, data.state])

    item = Item(
        owner=current_user,
        title=data.title,
        description=data.description,
        category=data.category,
        subcategory=data.subcategory,
        photos=data.photos or [],
        availability_type=data.availability_type.value,
        daily_rate=data.daily_rate,
        usage_rules=data.usage_rules,
        zip_code=data.zip_code or (current_user.zip_code if using_owner_address else None),
        neighborhood=data.neighborhood or (current_user.neighborhood if using_owner_address else None),
        city=data.city or (current_user.city if using_owner_address else None),
        state=data.state or (current_user.state if using_owner_address else None),
        latitude=data.latitude if data.latitude is not None else (current_user.latitude if using_owner_address else None),
        longitude=data.longitude if data.longitude is not None else (current_user.longitude if using_owner_address else None),
        groups=groups,
        is_public=data.is_public,
        available_days=data.available_days or [],
        requires_identity_verification=data.requires_identity_verification,
    )
    item.save()
    return _to_response(item)


def get_item(item_id: str, current_user: Optional[User] = None) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return _to_response(item, current_user)


def _search_items(qs, search: str, cap: Optional[int] = None) -> List[Item]:
    """Relevance-ranked full-text search over title + description, with a
    substring fallback for partial words $text can't match (it indexes
    whole/stemmed words — "furad" won't match "Furadeira") so users typing
    an incomplete word don't regress from the old icontains-only search."""
    text_qs = qs.search_text(search).order_by("$text_score")
    if cap is not None:
        text_qs = text_qs.limit(cap)
    text_items = list(text_qs)
    matched_ids = [i.id for i in text_items]

    fallback_qs = (
        qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        .filter(id__nin=matched_ids)
        .order_by("-created_at")
    )
    if cap is not None:
        remaining = max(cap - len(text_items), 0)
        fallback_qs = fallback_qs.limit(remaining) if remaining else fallback_qs.none()
    fallback_items = list(fallback_qs)

    return text_items + fallback_items


def list_items(
    search: Optional[str],
    category: Optional[str],
    availability_type: Optional[str],
    neighborhood: Optional[str],
    city: Optional[str],
    skip: int,
    limit: int,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    current_user: Optional[User] = None,
    subcategory: Optional[str] = None,
) -> List[ItemResponse]:
    qs = Item.objects(is_active=True, is_available=True, is_public=True)

    if category:
        qs = qs.filter(category=category)
    if subcategory:
        qs = qs.filter(subcategory=subcategory)
    if availability_type:
        qs = qs.filter(availability_type=availability_type)
    if neighborhood:
        qs = qs.filter(neighborhood__icontains=neighborhood)
    if city:
        qs = qs.filter(city__icontains=city)

    if lat is not None and lng is not None and radius_km:
        ordered = _search_items(qs, search) if search else qs.order_by("-created_at")
        all_items = [_to_response(i, current_user) for i in ordered]
        filtered = [
            item for item in all_items
            if item.latitude is not None and item.longitude is not None
            and _haversine_km(lat, lng, item.latitude, item.longitude) <= radius_km
        ]
        return filtered[skip: skip + limit]

    if search:
        items = _search_items(qs, search, cap=skip + limit)
        return [_to_response(i, current_user) for i in items[skip: skip + limit]]

    return [
        _to_response(i, current_user)
        for i in qs.skip(skip).limit(limit).order_by("-created_at")
    ]


def update_item(item_id: str, data: ItemUpdate, current_user: User) -> ItemResponse:
    item = _get_owned_item(item_id, current_user)

    updates = data.model_dump(exclude_none=True)
    for enum_field in ("category", "availability_type"):
        if enum_field in updates and hasattr(updates[enum_field], "value"):
            updates[enum_field] = updates[enum_field].value

    if "category" in updates or "subcategory" in updates:
        effective_category = updates.get("category", item.category)
        _validate_category(effective_category, updates.get("subcategory"))

    effective_availability = updates.get("availability_type", item.availability_type)
    if effective_availability == "paid" and not current_user.mp_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conecte sua conta Mercado Pago antes de tornar este item pago. Faça isso em /profile.",
        )

    if "group_ids" in updates:
        updates["groups"] = _resolve_member_groups(updates.pop("group_ids"), current_user)

    effective_is_public = updates.get("is_public", item.is_public)
    effective_groups = updates.get("groups", item.groups)
    _assert_visible(effective_is_public, effective_groups)

    updates["updated_at"] = datetime.utcnow()
    item.update(**updates)
    item.reload()
    return _to_response(item)


def delete_item(item_id: str, current_user: User) -> None:
    item = _get_owned_item(item_id, current_user)
    item.update(is_active=False, updated_at=datetime.utcnow())


def set_availability(
    item_id: str,
    is_available: bool,
    current_user: User,
    background_tasks: Optional[BackgroundTasks] = None,
) -> ItemResponse:
    item = _get_owned_item(item_id, current_user)

    became_available = is_available and not item.is_available
    waiting = list(item.waitlist or [])

    updates = {"is_available": is_available, "updated_at": datetime.utcnow()}
    if became_available and waiting:
        updates["waitlist"] = []
    item.update(**updates)
    item.reload()

    if became_available and waiting and background_tasks:
        for user in waiting:
            background_tasks.add_task(
                email_service.send_item_available_email,
                user.email,
                user.name,
                item.title,
                str(item.id),
            )

    return _to_response(item)


def get_user_items(user_id: str, current_user: Optional[User] = None) -> List[ItemResponse]:
    qs = Item.objects(owner=user_id, is_active=True)
    # Only the owner sees their own group-only items in this listing —
    # everyone else (including logged-in visitors) gets the public subset.
    if not (current_user and str(current_user.id) == user_id):
        qs = qs.filter(is_public=True)
    return [_to_response(i, current_user) for i in qs.order_by("-created_at")]


def list_group_items(group_id: str, current_user: User) -> List[ItemResponse]:
    group = Group.objects(id=group_id).first()
    is_member = group and any(str(m.id) == str(current_user.id) for m in group.members)
    if not group or not (is_member or current_user.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    items = Item.objects(groups=group, is_active=True, is_available=True).order_by("-created_at")
    return [_to_response(i, current_user) for i in items]


def set_favorite(item_id: str, current_user: User, favorite: bool) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    favorites = [f for f in (current_user.favorites or []) if str(f.id) != item_id]
    if favorite:
        favorites.append(item)
    current_user.update(favorites=favorites)

    response = _to_response(item)
    response.is_favorited = favorite
    return response


def set_waitlist(item_id: str, current_user: User, join: bool) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    if join:
        if item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item is already available — no need to wait",
            )
        if str(item.owner.id) == str(current_user.id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot wait on your own item")

    waitlist = [u for u in (item.waitlist or []) if str(u.id) != str(current_user.id)]
    if join:
        waitlist.append(current_user)
    item.update(waitlist=waitlist)
    item.reload()

    response = _to_response(item, current_user)
    response.is_waitlisted = join
    return response


def get_favorite_items(current_user: User) -> List[ItemResponse]:
    return [
        _to_response(item, current_user)
        for item in (current_user.favorites or [])
        if item.is_active
    ]


async def upload_photo(item_id: str, file: UploadFile, current_user: User) -> ItemResponse:
    item = _get_owned_item(item_id, current_user)

    if file.content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    raw = await file.read()
    try:
        Image.open(io.BytesIO(raw)).verify()
        # Re-open after verify() (which leaves the image unusable) and
        # convert to RGB — this also strips EXIF metadata (including any
        # embedded GPS coordinates from phone photos), relevant on a
        # neighborhood-lending app where a photo could otherwise leak a
        # user's exact home location independent of the CEP-based fields.
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Arquivo de imagem inválido")

    img.thumbnail((MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION))

    item_dir = os.path.join("uploads", "items", str(item.id))
    os.makedirs(item_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(item_dir, filename), "JPEG", quality=85)

    url = f"{settings.API_PUBLIC_URL}/uploads/items/{item.id}/{filename}"
    item.update(photos=(item.photos or []) + [url], updated_at=datetime.utcnow())
    item.reload()
    return _to_response(item)
