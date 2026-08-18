from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemResponse
from app.services.item_service._common import to_response
from app.utils import errors


def set_favorite(item_id: str, current_user: User, favorite: bool) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")

    favorites = [f for f in (current_user.favorites or []) if str(f.id) != item_id]
    if favorite:
        favorites.append(item)
    current_user.update(favorites=favorites)

    response = to_response(item)
    response.is_favorited = favorite
    return response


def set_waitlist(item_id: str, current_user: User, join: bool) -> ItemResponse:
    item = Item.objects(id=item_id, is_active=True).first()
    if not item:
        raise errors.not_found("Item not found")

    if join:
        if item.is_available:
            raise errors.bad_request(
                "Item is already available — no need to wait",
            )
        if str(item.owner.id) == str(current_user.id):
            raise errors.bad_request("Cannot wait on your own item")

    waitlist = [u for u in (item.waitlist or []) if str(u.id) != str(current_user.id)]
    if join:
        waitlist.append(current_user)
    item.update(waitlist=waitlist)
    item.reload()

    response = to_response(item, current_user)
    response.is_waitlisted = join
    return response


def get_favorite_items(
    current_user: User, skip: int = 0, limit: int = 50
) -> list[ItemResponse]:
    active = [item for item in (current_user.favorites or []) if item.is_active]
    return [to_response(item, current_user) for item in active[skip : skip + limit]]
