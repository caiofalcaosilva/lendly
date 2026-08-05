import os
import uuid

from fastapi import UploadFile

from app.config import settings
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth_service import user_to_response
from app.utils.images import load_and_resize
from app.utils.time import utcnow

AVATAR_DIMENSION = 400


async def upload_avatar(file: UploadFile, current_user: User) -> UserResponse:
    img = await load_and_resize(file)
    img.thumbnail((AVATAR_DIMENSION, AVATAR_DIMENSION))

    user_dir = os.path.join("uploads", "avatars", str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    img.save(os.path.join(user_dir, filename), "JPEG", quality=85)

    url = f"{settings.API_PUBLIC_URL}/uploads/avatars/{current_user.id}/{filename}"
    current_user.update(avatar_url=url, updated_at=utcnow())
    current_user.reload()
    return user_to_response(current_user)


def remove_avatar(current_user: User) -> UserResponse:
    current_user.update(unset__avatar_url=1, updated_at=utcnow())
    current_user.reload()
    return user_to_response(current_user)
