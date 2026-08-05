from datetime import timedelta

from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.view_as import ViewAsResponse
from app.services.auth_service import user_to_response
from app.utils.security import create_access_token

# Short-lived on purpose — this is a support/diagnostic tool, not a second
# real session. If it expires mid-use without the admin clicking "Sair",
# the next request just fails auth and the admin is back to being
# themselves (safe-by-default, not a silent privilege leak).
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

    # `type: view_as` is what the main.py middleware checks to block every
    # non-GET request made with this token — see block_view_as_mutations.
    token = create_access_token(
        data={"sub": str(target.id), "type": "view_as", "admin_id": str(admin.id)},
        expires_delta=timedelta(minutes=VIEW_AS_EXPIRE_MINUTES),
    )
    return ViewAsResponse(access_token=token, user=user_to_response(target))
