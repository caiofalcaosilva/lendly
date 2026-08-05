"""Split by responsibility across this package's modules (crud, favorites,
photos) — re-exported here so callers keep using `item_service.create_item`
etc. exactly as before the split."""

from app.services.item_service.crud import (
    create_item,
    delete_item,
    get_item,
    get_user_items,
    list_group_items,
    list_items,
    set_availability,
    update_item,
)
from app.services.item_service.favorites import (
    get_favorite_items,
    set_favorite,
    set_waitlist,
)
from app.services.item_service.photos import upload_photo

__all__ = [
    "create_item",
    "delete_item",
    "get_favorite_items",
    "get_item",
    "get_user_items",
    "list_group_items",
    "list_items",
    "set_availability",
    "set_favorite",
    "set_waitlist",
    "update_item",
    "upload_photo",
]
