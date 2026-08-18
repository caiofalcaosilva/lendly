from app.models.item import Item
from app.models.user import User
from app.schemas.admin_items import AdminItemSummary
from app.schemas.bulk import BulkActionResult
from app.services import activity_service
from app.utils import errors
from app.utils.bulk import run_bulk
from app.utils.time import utcnow


def _to_summary(item: Item) -> AdminItemSummary:
    owner = item.owner
    return AdminItemSummary(
        id=str(item.id),
        title=item.title,
        category=item.category,
        subcategory=item.subcategory,
        owner_id=str(owner.id),
        owner_name=owner.name,
        owner_email=owner.email,
        city=item.city,
        neighborhood=item.neighborhood,
        availability_type=item.availability_type,
        daily_rate=item.daily_rate,
        is_active=item.is_active,
        is_available=item.is_available,
        is_public=item.is_public,
        created_at=item.created_at,
    )


def list_items(search: str | None, skip: int, limit: int) -> list[AdminItemSummary]:
    qs = Item.objects().select_related(max_depth=1)
    if search:
        qs = qs.filter(title__icontains=search)
    return [_to_summary(i) for i in qs.order_by("-created_at").skip(skip).limit(limit)]


def _get_item(item_id: str) -> Item:
    item = Item.objects(id=item_id).first()
    if not item:
        raise errors.not_found("Item not found")
    return item


def get_item(item_id: str) -> AdminItemSummary:
    return _to_summary(_get_item(item_id))


def deactivate_item(item_id: str, admin: User) -> AdminItemSummary:
    item = _get_item(item_id)
    item.update(is_active=False, status_changed_by=admin, status_changed_at=utcnow())
    item.reload()
    activity_service.record(
        recipient=item.owner,
        event="admin.item_deactivated",
        actor=admin,
        resource_type="item",
        resource_id=str(item.id),
        resource_title=item.title,
    )
    return _to_summary(item)


def activate_item(item_id: str, admin: User) -> AdminItemSummary:
    item = _get_item(item_id)
    item.update(is_active=True, status_changed_by=admin, status_changed_at=utcnow())
    item.reload()
    activity_service.record(
        recipient=item.owner,
        event="admin.item_activated",
        actor=admin,
        resource_type="item",
        resource_id=str(item.id),
        resource_title=item.title,
    )
    return _to_summary(item)


def bulk_activate_items(item_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(item_ids, admin, activate_item)


def bulk_deactivate_items(item_ids: list[str], admin: User) -> BulkActionResult:
    return run_bulk(item_ids, admin, deactivate_item)
