import math

from fastapi import BackgroundTasks
from mongoengine import Q

from app.models.group import Group
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.services import (
    activity_service,
    category_service,
    email_service,
    notification_service,
)
from app.services.item_service._common import get_owned_item, to_response
from app.utils import errors
from app.utils.notifications import should_notify
from app.utils.time import utcnow


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return earth_radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _resolve_member_groups(group_ids: list[str], current_user: User) -> list[Group]:
    """Fetches the given groups, raising 403 if current_user isn't a member
    of any of them — you can only tag an item into a group you're in."""
    groups = []
    for group_id in group_ids:
        group = Group.objects(id=group_id).first()
        if not group or not any(
            str(m.id) == str(current_user.id) for m in group.members
        ):
            raise errors.forbidden(f"Not a member of group '{group_id}'")
        groups.append(group)
    return groups


def _assert_visible(is_public: bool, groups: list) -> None:
    if not is_public and not groups:
        raise errors.bad_request("Item must be public or belong to at least one group")


def _validate_category(category: str, subcategory: str | None) -> None:
    if not category_service.is_valid_category(category):
        raise errors.bad_request(f"Invalid category '{category}'")
    if subcategory and not category_service.is_valid_subcategory(category, subcategory):
        raise errors.bad_request(
            f"Invalid subcategory '{subcategory}' for category '{category}'"
        )


def create_item(data: ItemCreate, current_user: User) -> ItemResponse:
    if current_user.is_admin:
        raise errors.bad_request(
            "Contas administrativas não podem cadastrar itens",
        )

    if current_user.is_paused:
        raise errors.bad_request(
            "Reative sua conta antes de cadastrar um novo item",
        )

    if data.availability_type.value == "paid" and not data.daily_rate:
        raise errors.bad_request("Paid items must have a daily_rate greater than 0")

    if data.availability_type.value == "paid" and not current_user.mp_user_id:
        raise errors.bad_request(
            "Conecte sua conta Mercado Pago antes de anunciar um item pago. "
            "Faça isso em /profile."
        )

    _validate_category(data.category, data.subcategory)

    groups = _resolve_member_groups(data.group_ids or [], current_user)
    _assert_visible(data.is_public, groups)

    # Fall back to the owner's address only when none was given at all —
    # a partial custom address must never get the owner's lat/lng mixed in.
    using_owner_address = not any(
        [data.zip_code, data.neighborhood, data.city, data.state]
    )

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
        zip_code=data.zip_code
        or (current_user.zip_code if using_owner_address else None),
        neighborhood=data.neighborhood
        or (current_user.neighborhood if using_owner_address else None),
        city=data.city or (current_user.city if using_owner_address else None),
        state=data.state or (current_user.state if using_owner_address else None),
        latitude=data.latitude
        if data.latitude is not None
        else (current_user.latitude if using_owner_address else None),
        longitude=data.longitude
        if data.longitude is not None
        else (current_user.longitude if using_owner_address else None),
        groups=groups,
        is_public=data.is_public,
        available_days=data.available_days or [],
        requires_identity_verification=data.requires_identity_verification,
    )
    item.save()
    activity_service.record(
        recipient=current_user,
        event="item.created",
        actor=current_user,
        resource_type="item",
        resource_id=str(item.id),
        resource_title=item.title,
    )
    return to_response(item)


def get_item(item_id: str, current_user: User | None = None) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")
    return to_response(item, current_user)


def _search_items(qs, search: str, cap: int | None = None) -> list[Item]:
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


# A neighbor-lending app has no business surfacing an item hundreds of km
# away just because nothing else narrowed the search — this caps results
# even when the visitor never touched the distance filter, as long as we
# know at least one location for them (home address and/or live browser
# location; see list_items).
DEFAULT_MAX_RADIUS_KM = 50


def list_items(
    search: str | None,
    category: str | None,
    availability_type: str | None,
    neighborhood: str | None,
    city: str | None,
    skip: int,
    limit: int,
    lat: float | None = None,
    lng: float | None = None,
    lat2: float | None = None,
    lng2: float | None = None,
    radius_km: float | None = None,
    current_user: User | None = None,
    subcategory: str | None = None,
) -> list[ItemResponse]:
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

    # Up to two candidate origins — typically the visitor's home address
    # and their live browser location. An item matches if it's within
    # radius of EITHER one (union, not intersection): what matters to a
    # borrower is "close to home" OR "close to where I am right now".
    origin_candidates = [(lat, lng), (lat2, lng2)]
    origins = [
        (o_lat, o_lng)
        for o_lat, o_lng in origin_candidates
        if o_lat is not None and o_lng is not None
    ]
    effective_radius = radius_km or (DEFAULT_MAX_RADIUS_KM if origins else None)

    if effective_radius and origins:
        ordered = _search_items(qs, search) if search else qs.order_by("-created_at")
        all_items = [to_response(i, current_user) for i in ordered]
        filtered = [
            item
            for item in all_items
            if item.latitude is not None
            and item.longitude is not None
            and any(
                _haversine_km(o_lat, o_lng, item.latitude, item.longitude)
                <= effective_radius
                for o_lat, o_lng in origins
            )
        ]
        return filtered[skip : skip + limit]

    if search:
        items = _search_items(qs, search, cap=skip + limit)
        return [to_response(i, current_user) for i in items[skip : skip + limit]]

    return [
        to_response(i, current_user)
        for i in qs.skip(skip).limit(limit).order_by("-created_at")
    ]


def update_item(
    item_id: str,
    data: ItemUpdate,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> ItemResponse:
    item = get_owned_item(item_id, current_user)
    old_daily_rate = item.daily_rate
    old_availability_type = item.availability_type

    updates = data.model_dump(exclude_none=True)
    for enum_field in ("category", "availability_type"):
        if enum_field in updates and hasattr(updates[enum_field], "value"):
            updates[enum_field] = updates[enum_field].value

    if "category" in updates or "subcategory" in updates:
        effective_category = updates.get("category", item.category)
        _validate_category(effective_category, updates.get("subcategory"))

    effective_availability = updates.get("availability_type", item.availability_type)
    if effective_availability == "paid" and not current_user.mp_user_id:
        raise errors.bad_request(
            "Conecte sua conta Mercado Pago antes de tornar este item pago. "
            "Faça isso em /profile."
        )

    if "group_ids" in updates:
        updates["groups"] = _resolve_member_groups(
            updates.pop("group_ids"), current_user
        )

    effective_is_public = updates.get("is_public", item.is_public)
    effective_groups = updates.get("groups", item.groups)
    _assert_visible(effective_is_public, effective_groups)

    updates["updated_at"] = utcnow()
    item.update(**updates)
    item.reload()

    price_changed = "daily_rate" in updates and updates["daily_rate"] != old_daily_rate
    availability_changed = (
        "availability_type" in updates
        and updates["availability_type"] != old_availability_type
    )
    if price_changed or availability_changed:
        activity_service.record(
            recipient=current_user,
            event="item.updated",
            actor=current_user,
            resource_type="item",
            resource_id=str(item.id),
            resource_title=item.title,
        )
        if background_tasks:
            fans = User.objects(favorites=item, id__ne=current_user.id)
            for fan in fans:
                activity_service.record(
                    recipient=fan,
                    event="item.updated",
                    actor=current_user,
                    resource_type="item",
                    resource_id=str(item.id),
                    resource_title=item.title,
                )
                background_tasks.add_task(
                    notification_service.create_notification,
                    fan,
                    "favorite_item_changed",
                    f"{item.title} mudou",
                    "Preço ou forma de disponibilização atualizados."
                    if price_changed
                    else "Passou a ser gratuito ou pago.",
                    f"/items/{item.id}",
                )

    return to_response(item)


def _notify_fans_item_gone(
    item: Item,
    current_user: User,
    event: str,
    title: str,
    body: str,
    background_tasks: BackgroundTasks,
) -> None:
    fans = User.objects(favorites=item, id__ne=current_user.id)
    for fan in fans:
        activity_service.record(
            recipient=fan,
            event=event,
            actor=current_user,
            resource_type="item",
            resource_id=str(item.id),
            resource_title=item.title,
        )
        background_tasks.add_task(
            notification_service.create_notification,
            fan,
            "favorite_item_changed",
            title,
            body,
            None,
        )


def delete_item(
    item_id: str,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> None:
    item = get_owned_item(item_id, current_user)
    item.update(is_active=False, updated_at=utcnow())
    activity_service.record(
        recipient=current_user,
        event="item.removed",
        actor=current_user,
        resource_type="item",
        resource_id=str(item.id),
        resource_title=item.title,
    )
    if background_tasks:
        _notify_fans_item_gone(
            item,
            current_user,
            "item.removed",
            f"{item.title} foi removido",
            "O item deixou de estar disponível na plataforma.",
            background_tasks,
        )


def set_availability(
    item_id: str,
    is_available: bool,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> ItemResponse:
    item = get_owned_item(item_id, current_user)

    became_available = is_available and not item.is_available
    became_unavailable = not is_available and item.is_available
    waiting = list(item.waitlist or [])

    updates = {"is_available": is_available, "updated_at": utcnow()}
    if became_available and waiting:
        updates["waitlist"] = []
    item.update(**updates)
    item.reload()

    if became_unavailable:
        activity_service.record(
            recipient=current_user,
            event="item.paused",
            actor=current_user,
            resource_type="item",
            resource_id=str(item.id),
            resource_title=item.title,
        )
    if became_available:
        activity_service.record(
            recipient=current_user,
            event="item.resumed",
            actor=current_user,
            resource_type="item",
            resource_id=str(item.id),
            resource_title=item.title,
        )

    if became_unavailable and background_tasks:
        _notify_fans_item_gone(
            item,
            current_user,
            "item.paused",
            f"{item.title} foi pausado",
            "O dono marcou o item como temporariamente indisponível.",
            background_tasks,
        )

    if became_available and waiting and background_tasks:
        for user in waiting:
            if should_notify(user, "item_available"):
                background_tasks.add_task(
                    email_service.send_item_available_email,
                    user.email,
                    user.name,
                    item.title,
                    str(item.id),
                )
            activity_service.record(
                recipient=user,
                event="item.resumed",
                actor=current_user,
                resource_type="item",
                resource_id=str(item.id),
                resource_title=item.title,
            )
            background_tasks.add_task(
                notification_service.create_notification,
                user,
                "item_available",
                f"{item.title} está disponível de novo!",
                None,
                f"/items/{item.id}",
            )

    return to_response(item)


def get_user_items(
    user_id: str, current_user: User | None = None
) -> list[ItemResponse]:
    qs = Item.objects(owner=user_id, is_active=True)
    # Only the owner sees their own group-only items in this listing —
    # everyone else (including logged-in visitors) gets the public subset.
    if not (current_user and str(current_user.id) == user_id):
        qs = qs.filter(is_public=True)
    return [to_response(i, current_user) for i in qs.order_by("-created_at")]


def list_group_items(group_id: str, current_user: User) -> list[ItemResponse]:
    group = Group.objects(id=group_id).first()
    is_member = group and any(str(m.id) == str(current_user.id) for m in group.members)
    if not group or not (is_member or current_user.is_admin):
        raise errors.not_found("Group not found")
    items = Item.objects(groups=group, is_active=True, is_available=True).order_by(
        "-created_at"
    )
    return [to_response(i, current_user) for i in items]
