from datetime import timedelta

from app.config import settings
from app.models.user import User
from app.schemas.payment import MercadoPagoConnectResponse, MercadoPagoConnectStatus
from app.services import activity_service, mercadopago_gateway
from app.services.mercadopago_gateway import MercadoPagoError
from app.utils import errors
from app.utils.crypto import encrypt
from app.utils.time import utcnow

_REDIRECT_PATH = "/mercadopago/callback"


def get_connect_url(current_user: User) -> MercadoPagoConnectResponse:
    redirect_uri = f"{settings.FRONTEND_URL}{_REDIRECT_PATH}"
    state = mercadopago_gateway.new_state_token()
    current_user.update(mp_oauth_state=state)
    url = mercadopago_gateway.get_authorization_url(redirect_uri, state)
    return MercadoPagoConnectResponse(authorization_url=url)


def handle_callback(
    code: str, state: str, current_user: User
) -> MercadoPagoConnectStatus:
    if not state or state != current_user.mp_oauth_state:
        raise errors.bad_request(
            "Sessão de conexão inválida ou expirada — tente conectar novamente",
        )
    current_user.update(unset__mp_oauth_state=1)

    redirect_uri = f"{settings.FRONTEND_URL}{_REDIRECT_PATH}"
    try:
        token_data = mercadopago_gateway.exchange_oauth_code(code, redirect_uri)
    except MercadoPagoError as e:
        raise errors.bad_gateway(
            f"Não foi possível conectar sua conta Mercado Pago ({e}).",
        ) from e

    expires_in = token_data.get("expires_in", 15552000)  # MP default ~6 months
    current_user.update(
        mp_user_id=str(token_data["user_id"]),
        mp_access_token=encrypt(token_data["access_token"]),
        mp_refresh_token=encrypt(token_data["refresh_token"]),
        mp_token_expires_at=utcnow() + timedelta(seconds=expires_in),
        mp_connected_at=utcnow(),
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
    return MercadoPagoConnectStatus(
        connected=bool(current_user.mp_user_id),
        connected_at=current_user.mp_connected_at,
    )
