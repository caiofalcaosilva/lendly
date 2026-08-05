import io
import os
import uuid

from fastapi import HTTPException, UploadFile
from PIL import Image

from app.config import settings
from app.models.user import User
from app.schemas.item import ItemResponse
from app.services.item_service._common import get_owned_item, to_response
from app.utils.time import utcnow

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_DIMENSION = 1600


async def upload_photo(
    item_id: str, file: UploadFile, current_user: User
) -> ItemResponse:
    item = get_owned_item(item_id, current_user)

    if file.content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    raw = await file.read()
    try:
        Image.open(io.BytesIO(raw)).verify()
        # Re-open after verify() (which leaves the image unusable) and
        # convert to RGB — this also strips EXIF metadata (including any
        # embedded GPS coordinates from phone photos), relevant on a
        # neighborhood-lending app where a photo could otherwise leak a
        # user's exact home location independent of the CEP-based fields.
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as err:
        raise HTTPException(
            status_code=400, detail="Arquivo de imagem inválido"
        ) from err

    img.thumbnail((MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION))

    item_dir = os.path.join("uploads", "items", str(item.id))
    os.makedirs(item_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(item_dir, filename), "JPEG", quality=85)

    url = f"{settings.API_PUBLIC_URL}/uploads/items/{item.id}/{filename}"
    item.update(photos=(item.photos or []) + [url], updated_at=utcnow())
    item.reload()
    return to_response(item)
