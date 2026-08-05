from app.models.user import User
from app.schemas.user import FavoriteUserSummary, PublicUserResponse
from app.services.auth_service import user_to_public_response
from app.utils import errors


def set_favorite_user(
    user_id: str, current_user: User, favorite: bool
) -> PublicUserResponse:
    if user_id == str(current_user.id):
        raise errors.bad_request("Cannot favorite yourself")

    target = User.objects(id=user_id, is_active=True, is_admin__ne=True).first()
    if not target:
        raise errors.not_found("User not found")

    favorites = [u for u in (current_user.favorite_users or []) if str(u.id) != user_id]
    if favorite:
        favorites.append(target)
    current_user.update(favorite_users=favorites)
    current_user.reload()

    return user_to_public_response(target, viewer=current_user)


def get_favorite_users(current_user: User) -> list[FavoriteUserSummary]:
    return [
        FavoriteUserSummary(
            id=str(u.id),
            name=u.name,
            avatar_url=u.avatar_url,
            trade_name=u.trade_name,
            account_type=u.account_type or "individual",
            business_category=u.business_category,
            city=u.city,
            neighborhood=u.neighborhood,
            average_rating=u.average_rating,
            reliability_score=u.reliability_score,
            reliability_count=u.reliability_count or 0,
        )
        for u in (current_user.favorite_users or [])
        if u.is_active and not u.is_admin
    ]
