from datetime import datetime

from fastapi import BackgroundTasks
from mongoengine import Q

from app.config import settings
from app.models.group import Group
from app.models.item import Item
from app.models.user import User
from app.schemas.item import (
    ItemAvailabilityResponse,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from app.services import (
    activity_service,
    category_service,
    email_service,
    notification_service,
    storage,
)
from app.services.item_service._common import get_owned_item, to_response
from app.services.loan_request_service._common import (
    compute_next_available_date,
    reserved_quantity,
)
from app.utils import errors
from app.utils.geo import haversine_km, radius_km_to_radians, to_point
from app.utils.money import to_cents
from app.utils.notifications import should_notify
from app.utils.time import utcnow


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


def _notify_groups_of_new_item(
    groups: list[Group],
    item: Item,
    current_user: User,
    background_tasks: BackgroundTasks,
) -> None:
    """One Activity row + one notification per (recipient, group) — an item
    shared into 2 of your groups is 2 distinct contextual events, same
    reasoning as every other multi-recipient loop in this codebase. Uses
    resource_type="group" (not "item") so this shows up when the group's
    own activity feed filters by (resource_type=group, resource_id):
    scoping it to "item" would make it invisible there."""
    for group in groups:
        for member in group.members:
            if member.id == current_user.id:
                continue
            activity_service.record(
                recipient=member,
                event="group.item_shared",
                actor=current_user,
                resource_type="group",
                resource_id=str(group.id),
                resource_title=group.name,
                metadata={"item_id": str(item.id), "item_title": item.title},
            )
            background_tasks.add_task(
                notification_service.create_notification,
                member,
                "group_new_item",
                item.title,
                f"Novo item no grupo {group.name}",
                f"/items/{item.id}",
            )


def create_item(
    data: ItemCreate,
    current_user: User,
    background_tasks: BackgroundTasks | None = None,
) -> ItemResponse:
    if current_user.is_admin:
        raise errors.bad_request(
            "Contas administrativas não podem cadastrar itens",
        )

    if current_user.is_paused:
        raise errors.bad_request(
            "Reative sua conta antes de cadastrar um novo item",
        )
    # Deferred import to avoid a module-level cycle (claim_service pulls
    # in loan_request_service's __init__.py, which this module's own
    # reserved_quantity import already touches).
    from app.services.claim_service import assert_not_restricted

    assert_not_restricted(current_user)

    if data.availability_type.value == "paid" and settings.FREE_LENDING_ONLY:
        raise errors.bad_request(
            "No momento o Lendly só aceita itens em empréstimo gratuito."
        )

    if data.availability_type.value == "paid" and not data.daily_rate:
        raise errors.bad_request("Paid items must have a daily_rate greater than 0")

    daily_rate_cents = to_cents(data.daily_rate)
    weekly_rate_cents = to_cents(data.weekly_rate)
    monthly_rate_cents = to_cents(data.monthly_rate)
    delivery_fee_cents = to_cents(data.delivery_fee)
    declared_value_cents = to_cents(data.declared_value)

    mp_connected = bool(
        current_user.mp_connection and current_user.mp_connection.mp_user_id
    )
    if data.availability_type.value == "paid" and not mp_connected:
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

    latitude = (
        data.latitude
        if data.latitude is not None
        else (current_user.latitude if using_owner_address else None)
    )
    longitude = (
        data.longitude
        if data.longitude is not None
        else (current_user.longitude if using_owner_address else None)
    )

    item = Item(
        owner=current_user,
        title=data.title,
        description=data.description,
        category=data.category,
        subcategory=data.subcategory,
        photos=data.photos or [],
        availability_type=data.availability_type.value,
        quantity_total=data.quantity_total,
        daily_rate_cents=daily_rate_cents,
        weekly_rate_cents=weekly_rate_cents,
        monthly_rate_cents=monthly_rate_cents,
        delivery_fee_cents=delivery_fee_cents,
        declared_value_cents=declared_value_cents,
        usage_rules=data.usage_rules,
        zip_code=data.zip_code
        or (current_user.zip_code if using_owner_address else None),
        neighborhood=data.neighborhood
        or (current_user.neighborhood if using_owner_address else None),
        city=data.city or (current_user.city if using_owner_address else None),
        state=data.state or (current_user.state if using_owner_address else None),
        latitude=latitude,
        longitude=longitude,
        location=to_point(latitude, longitude),
        groups=groups,
        is_public=data.is_public,
        available_days=data.available_days or [],
        requires_identity_verification=data.requires_identity_verification,
        fulfillment_options=[o.value for o in data.fulfillment_options],
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
    if background_tasks and groups:
        _notify_groups_of_new_item(groups, item, current_user, background_tasks)
    return to_response(item, current_user)


def get_item(item_id: str, current_user: User | None = None) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")
    next_available_date = compute_next_available_date(item)
    return to_response(item, current_user, next_available_date=next_available_date)


def check_availability(
    item_id: str, pickup_date: datetime, expected_return_date: datetime
) -> ItemAvailabilityResponse:
    """How many units are free for a candidate date range — lets the
    request form bound its quantity picker before submitting, using the
    same overlap math create_request itself enforces server-side."""
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")
    quantity_total = item.quantity_total or 1
    reserved = reserved_quantity(item, pickup_date, expected_return_date)
    return ItemAvailabilityResponse(
        available_units=max(quantity_total - reserved, 0),
        quantity_total=quantity_total,
    )


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
    sort: str | None = None,
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
        # $geoWithin/$centerSphere via the 2dsphere index on `location` does
        # the actual radius filtering in Mongo — union of up to 2 origins is
        # just an OR of two geo clauses. Only the (now much smaller)
        # resulting candidate set gets dereferenced/materialized below.
        radius_radians = radius_km_to_radians(effective_radius)
        geo_clauses = [
            Q(location__geo_within_sphere=[to_point(o_lat, o_lng), radius_radians])
            for o_lat, o_lng in origins
        ]
        geo_q = geo_clauses[0]
        for clause in geo_clauses[1:]:
            geo_q |= clause
        qs = qs.filter(geo_q)

        ordered = _search_items(qs, search) if search else qs.order_by("-created_at")
        all_items = [to_response(i, current_user) for i in ordered]
        # Distance to the nearest of the (up to two) origins is computed
        # here regardless of `sort` — needed for sort=nearest, and this
        # candidate set is already small (radius-filtered by the query
        # above), so recomputing it in Python here costs little. lat/lng are
        # never None here — the geo filter above only matches items whose
        # `location` (kept in sync with latitude/longitude on every write)
        # is set — but the schema types them as optional, so narrow explicitly.
        candidates = [
            (
                item,
                min(
                    haversine_km(o_lat, o_lng, item.latitude, item.longitude)
                    for o_lat, o_lng in origins
                ),
            )
            for item in all_items
            if item.latitude is not None and item.longitude is not None
        ]
        if sort == "nearest":
            candidates.sort(key=lambda pair: pair[1])
        elif sort == "price_asc":
            candidates.sort(key=lambda pair: pair[0].daily_rate or 0)
        return [item for item, _ in candidates][skip : skip + limit]

    if search:
        if sort == "price_asc":
            # Uncapped, same as the radius branch above — needs every match
            # in hand before it can be reordered by price, not just the
            # page currently being requested.
            items = _search_items(qs, search)
            responses = sorted(
                (to_response(i, current_user) for i in items),
                key=lambda r: r.daily_rate or 0,
            )
            return responses[skip : skip + limit]
        items = _search_items(qs, search, cap=skip + limit)
        return [to_response(i, current_user) for i in items[skip : skip + limit]]

    if sort == "price_asc":
        return [
            to_response(i, current_user)
            for i in qs.skip(skip).limit(limit).order_by("daily_rate_cents")
        ]

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
    old_daily_rate_cents = item.daily_rate_cents
    old_availability_type = item.availability_type

    updates = data.model_dump(exclude_none=True)
    for enum_field in ("category", "availability_type"):
        if enum_field in updates and hasattr(updates[enum_field], "value"):
            updates[enum_field] = updates[enum_field].value
    # fulfillment_options is a *list* of enums — the scalar-flatten loop
    # above doesn't touch it.
    if "fulfillment_options" in updates:
        updates["fulfillment_options"] = [
            o.value if hasattr(o, "value") else o
            for o in updates["fulfillment_options"]
        ]

    if "category" in updates or "subcategory" in updates:
        effective_category = updates.get("category", item.category)
        _validate_category(effective_category, updates.get("subcategory"))

    effective_availability = updates.get("availability_type", item.availability_type)
    if effective_availability == "paid" and settings.FREE_LENDING_ONLY:
        raise errors.bad_request(
            "No momento o Lendly só aceita itens em empréstimo gratuito."
        )
    mp_connected = bool(
        current_user.mp_connection and current_user.mp_connection.mp_user_id
    )
    if effective_availability == "paid" and not mp_connected:
        raise errors.bad_request(
            "Conecte sua conta Mercado Pago antes de tornar este item pago. "
            "Faça isso em /profile."
        )

    newly_added_groups: list[Group] = []
    if "group_ids" in updates:
        new_groups = _resolve_member_groups(updates.pop("group_ids"), current_user)
        old_group_ids = {str(g.id) for g in item.groups}
        newly_added_groups = [g for g in new_groups if str(g.id) not in old_group_ids]
        updates["groups"] = new_groups

    effective_is_public = updates.get("is_public", item.is_public)
    effective_groups = updates.get("groups", item.groups)
    _assert_visible(effective_is_public, effective_groups)

    # `photos` is a full-array replacement (not append/remove), so any URL
    # dropped from the old array needs its file cleaned up explicitly —
    # item.update() below would otherwise just orphan it in storage.
    removed_photo_urls: list[str] = []
    if "photos" in updates:
        removed_photo_urls = list(set(item.photos or []) - set(updates["photos"] or []))

    if "latitude" in updates or "longitude" in updates:
        updates["location"] = to_point(
            updates.get("latitude", item.latitude),
            updates.get("longitude", item.longitude),
        )

    for money_field in (
        "daily_rate",
        "weekly_rate",
        "monthly_rate",
        "delivery_fee",
        "declared_value",
    ):
        if money_field in updates:
            updates[f"{money_field}_cents"] = to_cents(updates.pop(money_field))

    updates["updated_at"] = utcnow()
    item.update(**updates)
    item.reload()
    for url in removed_photo_urls:
        storage.delete_public_image(url)

    if background_tasks and newly_added_groups:
        _notify_groups_of_new_item(
            newly_added_groups, item, current_user, background_tasks
        )

    price_changed = (
        "daily_rate_cents" in updates
        and updates["daily_rate_cents"] != old_daily_rate_cents
    )
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

    return to_response(item, current_user)


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

    return to_response(item, current_user)


def get_user_items(
    user_id: str, current_user: User | None = None
) -> list[ItemResponse]:
    qs = Item.objects(owner=user_id, is_active=True)
    # Only the owner sees their own group-only items in this listing —
    # everyone else (including logged-in visitors) gets the public subset.
    if not (current_user and str(current_user.id) == user_id):
        qs = qs.filter(is_public=True)
    return [to_response(i, current_user) for i in qs.order_by("-created_at")]


def list_group_items(
    group_id: str, current_user: User, skip: int = 0, limit: int = 24
) -> list[ItemResponse]:
    group = Group.objects(id=group_id).first()
    is_member = group and any(str(m.id) == str(current_user.id) for m in group.members)
    if not group or not (is_member or current_user.is_admin):
        raise errors.not_found("Group not found")
    items = (
        Item.objects(groups=group, is_active=True, is_available=True)
        .order_by("-created_at")
        .skip(skip)
        .limit(limit)
    )
    return [to_response(i, current_user) for i in items]
