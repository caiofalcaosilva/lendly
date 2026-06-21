import math
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status

from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemOwnerResponse, ItemResponse, ItemUpdate


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _to_response(item: Item) -> ItemResponse:
    owner = item.owner
    return ItemResponse(
        id=str(item.id),
        owner=ItemOwnerResponse(
            id=str(owner.id),
            name=owner.name,
            neighborhood=owner.neighborhood,
            city=owner.city,
            average_rating=owner.average_rating,
        ),
        title=item.title,
        description=item.description,
        category=item.category,
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
        created_at=item.created_at,
    )


def _get_owned_item(item_id: str, current_user: User) -> Item:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if str(item.owner.id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the owner")
    return item


def create_item(data: ItemCreate, current_user: User) -> ItemResponse:
    if data.availability_type.value == "paid" and not data.daily_rate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Paid items must have a daily_rate greater than 0",
        )

    item = Item(
        owner=current_user,
        title=data.title,
        description=data.description,
        category=data.category.value,
        photos=data.photos or [],
        availability_type=data.availability_type.value,
        daily_rate=data.daily_rate,
        usage_rules=data.usage_rules,
        zip_code=data.zip_code,
        neighborhood=data.neighborhood or current_user.neighborhood,
        city=data.city or current_user.city,
        state=data.state,
        latitude=data.latitude or current_user.latitude,
        longitude=data.longitude or current_user.longitude,
    )
    item.save()
    return _to_response(item)


def get_item(item_id: str) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return _to_response(item)


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
) -> List[ItemResponse]:
    qs = Item.objects(is_active=True, is_available=True)

    if search:
        qs = qs.filter(title__icontains=search)
    if category:
        qs = qs.filter(category=category)
    if availability_type:
        qs = qs.filter(availability_type=availability_type)
    if neighborhood:
        qs = qs.filter(neighborhood__icontains=neighborhood)
    if city:
        qs = qs.filter(city__icontains=city)

    if lat is not None and lng is not None and radius_km:
        all_items = [_to_response(i) for i in qs.order_by("-created_at")]
        filtered = [
            item for item in all_items
            if item.latitude is not None and item.longitude is not None
            and _haversine_km(lat, lng, item.latitude, item.longitude) <= radius_km
        ]
        return filtered[skip: skip + limit]

    return [_to_response(i) for i in qs.skip(skip).limit(limit).order_by("-created_at")]


def update_item(item_id: str, data: ItemUpdate, current_user: User) -> ItemResponse:
    item = _get_owned_item(item_id, current_user)

    updates = data.model_dump(exclude_none=True)
    for enum_field in ("category", "availability_type"):
        if enum_field in updates and hasattr(updates[enum_field], "value"):
            updates[enum_field] = updates[enum_field].value

    updates["updated_at"] = datetime.utcnow()
    item.update(**updates)
    item.reload()
    return _to_response(item)


def delete_item(item_id: str, current_user: User) -> None:
    item = _get_owned_item(item_id, current_user)
    item.update(is_active=False, updated_at=datetime.utcnow())


def set_availability(item_id: str, is_available: bool, current_user: User) -> ItemResponse:
    item = _get_owned_item(item_id, current_user)
    item.update(is_available=is_available, updated_at=datetime.utcnow())
    item.reload()
    return _to_response(item)


def get_user_items(user_id: str) -> List[ItemResponse]:
    return [
        _to_response(i)
        for i in Item.objects(owner=user_id, is_active=True).order_by("-created_at")
    ]
