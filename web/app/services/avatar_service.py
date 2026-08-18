import uuid

from fastapi import UploadFile

from app.models.user import User
from app.schemas.user import UserResponse
from app.services import storage
from app.services.auth_service import user_to_response
from app.utils.images import load_and_resize
from app.utils.time import utcnow

AVATAR_DIMENSION = 400


async def upload_avatar(file: UploadFile, current_user: User) -> UserResponse:
    img = await load_and_resize(file)
    img.thumbnail((AVATAR_DIMENSION, AVATAR_DIMENSION))

    key = f"avatars/{current_user.id}/{uuid.uuid4().hex}.jpg"
    url = storage.save_public_image(img, key)
    old_avatar_url = current_user.avatar_url
    current_user.update(avatar_url=url, updated_at=utcnow())
    current_user.reload()
    storage.delete_public_image(old_avatar_url)
    return user_to_response(current_user)


def remove_avatar(current_user: User) -> UserResponse:
    old_avatar_url = current_user.avatar_url
    current_user.update(unset__avatar_url=1, updated_at=utcnow())
    current_user.reload()
    storage.delete_public_image(old_avatar_url)
    return user_to_response(current_user)
