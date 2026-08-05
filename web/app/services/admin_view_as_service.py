from datetime import timedelta

from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.view_as import ViewAsResponse
from app.services.auth_service import user_to_response
from app.utils.security import create_access_token

# Short-lived on purpose — a support tool, not a second real session.
VIEW_AS_EXPIRE_MINUTES = 30


def create_view_as_token(admin: User, target_user_id: str) -> ViewAsResponse:
    target = User.objects(id=target_user_id, is_active=True).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if str(target.id) == str(admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível visualizar como você mesmo",
        )
    if target.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível visualizar como outro admin",
        )

    # main.py's block_view_as_mutations middleware checks this claim.
    token = create_access_token(
        data={"sub": str(target.id), "type": "view_as", "admin_id": str(admin.id)},
        expires_delta=timedelta(minutes=VIEW_AS_EXPIRE_MINUTES),
    )
    return ViewAsResponse(access_token=token, user=user_to_response(target))
