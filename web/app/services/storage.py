import io
import os

from PIL import Image

from app.config import settings


def _r2_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )


def _r2_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _encode_jpeg(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def save_public_image(image: Image.Image, key: str) -> str:
    """Saves a JPEG at `key` (e.g. "items/<id>/<uuid>.jpg") and returns the
    public URL to serve it from — R2 if configured, otherwise local disk
    under uploads/ (mounted as static in main.py), exactly as before R2
    support existed."""
    data = _encode_jpeg(image)

    if _r2_configured():
        _r2_client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType="image/jpeg",
        )
        return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"

    path = os.path.join("uploads", key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return f"{settings.API_PUBLIC_URL}/uploads/{key}"


def save_private_image(image: Image.Image, key: str) -> str:
    """Saves a JPEG at `key` somewhere not publicly reachable, and returns
    an opaque reference to hand to open_private_image later — an R2 key if
    configured, otherwise a local file path. Used for identity verification
    documents, which only an admin can ever view."""
    data = _encode_jpeg(image)

    if _r2_configured():
        _r2_client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType="image/jpeg",
        )
        return key

    path = os.path.join("verification_uploads", key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return path


def private_image_url(reference: str) -> str | None:
    """A short-lived presigned URL for a private image saved via
    save_private_image, if it's in R2 — None when it's a local path instead,
    meaning the caller should serve the file directly (see
    routers/verification.py)."""
    if not _r2_configured():
        return None
    return _r2_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": reference},
        ExpiresIn=300,
    )
