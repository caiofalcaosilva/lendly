import io
import logging
import os

from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


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


def delete_public_image(url: str | None) -> None:
    """Best-effort delete of a file previously saved via save_public_image,
    given the public URL that was returned for it — reverses the URL back
    into a storage key/path, R2 or local disk (whichever is configured
    now — if that switched since the file was saved, the reversal below
    just won't match the prefix and this quietly no-ops). Never raises: a
    missing/already-deleted file isn't worth failing the caller's actual
    business action over."""
    if not url:
        return
    try:
        if _r2_configured():
            prefix = f"{settings.R2_PUBLIC_URL.rstrip('/')}/"
            if not url.startswith(prefix):
                return
            _r2_client().delete_object(
                Bucket=settings.R2_BUCKET_NAME, Key=url[len(prefix) :]
            )
        else:
            prefix = f"{settings.API_PUBLIC_URL}/uploads/"
            if not url.startswith(prefix):
                return
            path = os.path.join("uploads", url[len(prefix) :])
            if os.path.exists(path):
                os.remove(path)
    except Exception:
        logger.exception("failed to delete old public image", extra={"url": url})


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


def open_private_image(reference: str) -> bytes:
    """Reads back a private image saved via save_private_image, wherever it
    lives — R2 or local disk.

    Fetched server-to-server and streamed back through our own API (see
    routers/verification.py) rather than redirecting the browser to a
    presigned R2 URL: that would make the browser issue a cross-origin
    fetch straight at r2.cloudflarestorage.com to read the response body
    (the frontend needs the bytes, not just to display an `<img>`), which
    R2 blocks by default without CORS configured on the bucket. Public
    item/profile photos never hit this — they're plain `<img src>` on the
    public R2 URL, which doesn't invoke CORS at all."""
    if _r2_configured():
        obj = _r2_client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=reference)
        return obj["Body"].read()
    with open(reference, "rb") as f:
        return f.read()
