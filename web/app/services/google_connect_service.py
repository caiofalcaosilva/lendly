import secrets

from app.models.user import User
from app.schemas.auth import GoogleConnectResponse, GoogleConnectStatus
from app.services import activity_service, google_oauth_gateway
from app.services.google_oauth_gateway import GoogleOAuthError
from app.utils import errors
from app.utils.time import utcnow
from app.utils.urls import frontend_origin

_REDIRECT_PATH = "/auth/google/connect/callback"


def get_connect_url(current_user: User) -> GoogleConnectResponse:
    redirect_uri = f"{frontend_origin()}{_REDIRECT_PATH}"
    state = secrets.token_urlsafe(24)
    current_user.update(set__google_connection__oauth_state=state)
    url = google_oauth_gateway.get_authorization_url(redirect_uri, state)
    return GoogleConnectResponse(authorization_url=url)


def handle_callback(code: str, state: str, current_user: User) -> GoogleConnectStatus:
    connection = current_user.google_connection
    if not state or state != (connection.oauth_state if connection else None):
        raise errors.bad_request(
            "Sessão de conexão inválida ou expirada — tente conectar novamente",
        )
    current_user.update(unset__google_connection__oauth_state=1)

    redirect_uri = f"{frontend_origin()}{_REDIRECT_PATH}"
    try:
        access_token = google_oauth_gateway.exchange_code(code, redirect_uri)
        info = google_oauth_gateway.get_userinfo(access_token)
    except GoogleOAuthError as e:
        raise errors.bad_gateway(str(e)) from e

    google_id = info.get("sub")
    if not google_id:
        raise errors.bad_gateway("Resposta incompleta da Google")

    existing = User.objects(google_connection__google_id=google_id).first()
    if existing and str(existing.id) != str(current_user.id):
        raise errors.bad_request("Essa conta Google já está conectada a outro usuário")

    current_user.update(
        set__google_connection__google_id=google_id,
        set__google_connection__connected_at=utcnow(),
    )
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.google_connected",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    return get_connect_status(current_user)


def get_connect_status(current_user: User) -> GoogleConnectStatus:
    connection = current_user.google_connection
    return GoogleConnectStatus(
        connected=bool(connection and connection.google_id),
        connected_at=connection.connected_at if connection else None,
    )
