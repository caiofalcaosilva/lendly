import io

from fastapi import UploadFile
from PIL import Image

from app.utils import errors

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_DIMENSION = 1600
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


async def load_and_resize(file: UploadFile) -> Image.Image:
    """Validates content-type, decodes, strips EXIF (re-opening after
    verify() and converting to RGB drops it — including any embedded GPS
    coordinates from phone photos, relevant for both item and identity
    verification photos), and downsizes to MAX_PHOTO_DIMENSION. Raises
    HTTPException(400) for anything that doesn't look like a real image
    of an allowed type."""
    if file.content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise errors.bad_request("Formato de imagem não suportado")

    # Read one byte past the cap so an oversized file is rejected here,
    # before PIL ever spends CPU/memory decoding it.
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise errors.bad_request("Imagem muito grande (máximo 8MB)")
    try:
        Image.open(io.BytesIO(raw)).verify()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as err:
        raise errors.bad_request("Arquivo de imagem inválido") from err

    img.thumbnail((MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION))
    return img
