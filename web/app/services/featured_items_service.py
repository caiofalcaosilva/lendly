from app.models.item import Item
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth_service import user_to_response
from app.utils import errors
from app.utils.time import utcnow


def set_featured_items(item_ids: list[str], current_user: User) -> UserResponse:
    if len(item_ids) != len(set(item_ids)):
        raise errors.bad_request("Itens duplicados na lista de destaque")

    items = list(Item.objects(id__in=item_ids, owner=current_user, is_active=True))
    if len(items) != len(item_ids):
        raise errors.bad_request(
            "Um ou mais itens não existem, não pertencem a você, ou estão inativos"
        )
    # Preserve the order the caller sent, not the query's — order is what
    # decides display order on the public profile.
    by_id = {str(i.id): i for i in items}
    ordered = [by_id[item_id] for item_id in item_ids]

    current_user.update(featured_items=ordered, updated_at=utcnow())
    current_user.reload()
    return user_to_response(current_user)
