import uuid

from fastapi import UploadFile

from app.models.user import User
from app.schemas.item import ItemResponse
from app.services import storage
from app.services.item_service._common import get_owned_item, to_response
from app.utils.images import load_and_resize
from app.utils.time import utcnow


async def upload_photo(
    item_id: str, file: UploadFile, current_user: User
) -> ItemResponse:
    item = get_owned_item(item_id, current_user)
    img = await load_and_resize(file)

    key = f"items/{item.id}/{uuid.uuid4().hex}.jpg"
    url = storage.save_public_image(img, key)
    item.update(photos=(item.photos or []) + [url], updated_at=utcnow())
    item.reload()
    return to_response(item)
