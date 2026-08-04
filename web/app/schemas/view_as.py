from pydantic import BaseModel

from app.schemas.user import UserResponse


class ViewAsResponse(BaseModel):
    access_token: str
    user: UserResponse
