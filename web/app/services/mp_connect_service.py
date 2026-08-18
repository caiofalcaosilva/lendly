from datetime import timedelta

from app.models.user import MercadoPagoConnection, User
from app.schemas.payment import MercadoPagoConnectResponse, MercadoPagoConnectStatus
from app.services import activity_service, mercadopago_gateway
from app.services.mercadopago_gateway import MercadoPagoError
from app.utils import errors
from app.utils.crypto import decrypt, encrypt
from app.utils.time import utcnow
from app.utils.urls import frontend_origin

_REDIRECT_PATH = "/mercadopago/callback"
# Refresh a bit before the real expiry rather than exactly at it, so a
# token that's valid-but-about-to-expire when checked doesn't die mid-request.
_REFRESH_MARGIN = timedelta(minutes=5)


def get_connect_url(current_user: User) -> MercadoPagoConnectResponse:
    redirect_uri = f"{frontend_origin()}{_REDIRECT_PATH}"
    state = mercadopago_gateway.new_state_token()
    current_user.update(set__mp_connection__oauth_state=state)
    url = mercadopago_gateway.get_authorization_url(redirect_uri, state)
    return MercadoPagoConnectResponse(authorization_url=url)


def handle_callback(
    code: str, state: str, current_user: User
) -> MercadoPagoConnectStatus:
    connection = current_user.mp_connection
    if not state or state != (connection.oauth_state if connection else None):
        raise errors.bad_request(
            "Sessão de conexão inválida ou expirada — tente conectar novamente",
        )
    current_user.update(unset__mp_connection__oauth_state=1)

    redirect_uri = f"{frontend_origin()}{_REDIRECT_PATH}"
    try:
        token_data = mercadopago_gateway.exchange_oauth_code(code, redirect_uri)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível conectar sua conta Mercado Pago ({e}).",
        ) from e

    expires_in = token_data.get("expires_in", 15552000)  # MP default ~6 months
    current_user.update(
        mp_connection=MercadoPagoConnection(
            mp_user_id=str(token_data["user_id"]),
            access_token=encrypt(token_data["access_token"]),
            refresh_token=encrypt(token_data["refresh_token"]),
            token_expires_at=utcnow() + timedelta(seconds=expires_in),
            connected_at=utcnow(),
        )
    )
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.mercadopago_connected",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    return get_connect_status(current_user)


def get_connect_status(current_user: User) -> MercadoPagoConnectStatus:
    connection = current_user.mp_connection
    return MercadoPagoConnectStatus(
        connected=bool(connection and connection.mp_user_id),
        connected_at=connection.connected_at if connection else None,
    )


def get_valid_access_token(user: User) -> str:
    """Decrypts the connected seller's stored access token, transparently
    refreshing it first if it's expired (or close to it) — introduced for
    the Orders API migration: unlike the old Advanced Payments flow, every
    charge/status-check/refund now runs *as* the seller, so this token
    actually gets used instead of just sitting on the User doc."""
    connection = user.mp_connection
    if not connection or not connection.access_token or not connection.refresh_token:
        raise MercadoPagoError(
            f"Usuário {user.id} não tem conta Mercado Pago conectada"
        )

    if (
        connection.token_expires_at
        and utcnow() < connection.token_expires_at - _REFRESH_MARGIN
    ):
        return decrypt(connection.access_token)

    token_data = mercadopago_gateway.refresh_oauth_token(
        decrypt(connection.refresh_token)
    )
    expires_in = token_data.get("expires_in", 15552000)  # MP default ~6 months
    user.update(
        set__mp_connection__access_token=encrypt(token_data["access_token"]),
        set__mp_connection__refresh_token=encrypt(token_data["refresh_token"]),
        set__mp_connection__token_expires_at=utcnow() + timedelta(seconds=expires_in),
    )
    return str(token_data["access_token"])
