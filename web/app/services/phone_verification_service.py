import secrets
from datetime import timedelta

from app.models.user import PhoneVerification, User
from app.schemas.user import PhoneVerificationSendResponse, UserResponse
from app.services import activity_service, sms_gateway
from app.services.auth_service._common import user_to_response
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils import errors
from app.utils.time import utcnow

# Mirrors DELIVERY_CODE_MAX_ATTEMPTS in loan_request_service/_common.py —
# same reasoning: a short numeric code is brute-forceable without a cap.
PHONE_VERIFICATION_MAX_ATTEMPTS = 5


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def send_code(current_user: User) -> PhoneVerificationSendResponse:
    if not current_user.phone:
        raise errors.bad_request("Cadastre um telefone antes de verificar")

    to_e164 = sms_gateway.to_e164_br(current_user.phone)
    code = _generate_code()
    expire_minutes = get_platform_settings().phone_verification_expire_minutes

    current_user.update(
        phone_verification=PhoneVerification(
            code=code,
            attempts=0,
            generated_at=utcnow(),
            expires_at=utcnow() + timedelta(minutes=expire_minutes),
        )
    )
    try:
        sms_gateway.send_sms(to_e164, f"Seu código Lendly: {code}")
    except sms_gateway.SmsGatewayError as e:
        raise errors.bad_gateway(str(e)) from e
    return PhoneVerificationSendResponse(sent=True)


def verify_code(current_user: User, code: str) -> UserResponse:
    verification = current_user.phone_verification
    if not verification:
        raise errors.bad_request("Nenhum código pendente — solicite um novo")

    if utcnow() > verification.expires_at:
        current_user.update(unset__phone_verification=1)
        raise errors.bad_request("Código expirado — solicite um novo")

    if verification.attempts >= PHONE_VERIFICATION_MAX_ATTEMPTS:
        raise errors.conflict("Número de tentativas excedido — solicite um novo código")

    if code.strip() != verification.code:
        current_user.update(inc__phone_verification__attempts=1)
        raise errors.bad_request("Código incorreto")

    current_user.update(phone_verified=True, unset__phone_verification=1)
    current_user.reload()
    activity_service.record(
        recipient=current_user,
        event="account.phone_verified",
        actor=current_user,
        resource_type="user",
        resource_id=str(current_user.id),
    )
    return user_to_response(current_user)
