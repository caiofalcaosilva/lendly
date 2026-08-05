import os
import uuid

from fastapi import UploadFile

from app.config import settings
from app.models.user import User
from app.schemas.item import ItemResponse
from app.services.item_service._common import get_owned_item, to_response
from app.utils.images import load_and_resize
from app.utils.time import utcnow


async def upload_photo(
    item_id: str, file: UploadFile, current_user: User
) -> ItemResponse:
    item = get_owned_item(item_id, current_user)
    img = await load_and_resize(file)

    item_dir = os.path.join("uploads", "items", str(item.id))
    os.makedirs(item_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(item_dir, filename), "JPEG", quality=85)

    url = f"{settings.API_PUBLIC_URL}/uploads/items/{item.id}/{filename}"
    item.update(photos=(item.photos or []) + [url], updated_at=utcnow())
    item.reload()
    return to_response(item)
