from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemGroupSummary, ItemOwnerResponse, ItemResponse
from app.utils import errors
from app.utils.money import to_reais


def _visible_group_summaries(
    item: Item, current_user: User | None
) -> list[ItemGroupSummary]:
    """Only groups the viewer could already navigate to on their own — a
    member of that specific group, the item's owner, or an admin. Groups
    are invite-only, so an item page (reachable by anyone with the link,
    public or not) must not be how someone learns a private group's name."""
    if not current_user:
        return []
    is_owner = str(item.owner.id) == str(current_user.id)
    return [
        ItemGroupSummary(id=str(g.id), name=g.name)
        for g in item.groups
        if is_owner
        or current_user.is_admin
        or any(str(m.id) == str(current_user.id) for m in g.members)
    ]


def to_response(item: Item, current_user: User | None = None) -> ItemResponse:
    owner = item.owner
    is_favorited = False
    if current_user and current_user.favorites:
        is_favorited = any(str(f.id) == str(item.id) for f in current_user.favorites)
    is_waitlisted = False
    if current_user and item.waitlist:
        is_waitlisted = any(str(u.id) == str(current_user.id) for u in item.waitlist)
    # Never shown on the public item page — a security/trust call made
    # explicitly, not an oversight (see docs on the roadmap decision).
    show_declared_value = current_user is not None and (
        str(owner.id) == str(current_user.id) or current_user.is_admin
    )
    return ItemResponse(
        id=str(item.id),
        owner=ItemOwnerResponse(
            id=str(owner.id),
            name=owner.name,
            neighborhood=owner.neighborhood,
            city=owner.city,
            average_rating=owner.reputation.average_rating,
            reliability_score=owner.reputation.reliability_score,
            reliability_count=owner.reputation.reliability_count or 0,
            account_type=owner.account_type or "individual",
            trade_name=owner.business_profile.trade_name
            if owner.business_profile
            else None,
        ),
        title=item.title,
        description=item.description,
        category=item.category,
        subcategory=item.subcategory,
        photos=item.photos or [],
        availability_type=item.availability_type,
        quantity_total=item.quantity_total or 1,
        daily_rate=to_reais(item.daily_rate_cents),
        weekly_rate=to_reais(item.weekly_rate_cents),
        monthly_rate=to_reais(item.monthly_rate_cents),
        delivery_fee=to_reais(item.delivery_fee_cents),
        declared_value=to_reais(item.declared_value_cents)
        if show_declared_value
        else None,
        has_declared_value=item.declared_value_cents is not None,
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
        group_summaries=_visible_group_summaries(item, current_user),
        available_days=item.available_days or [],
        requires_identity_verification=item.requires_identity_verification or False,
        fulfillment_options=item.fulfillment_options or ["pickup"],
        created_at=item.created_at,
    )


def get_owned_item(item_id: str, current_user: User) -> Item:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")
    if str(item.owner.id) != str(current_user.id):
        raise errors.forbidden("Not the owner")
    return item
