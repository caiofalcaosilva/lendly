from fastapi import APIRouter, BackgroundTasks, Header, Request

from app.services import payment_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/mercadopago", status_code=204)
async def mercadopago_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_signature: str = Header(default=""),
    x_request_id: str = Header(default=""),
):
    """Mercado Pago payment notifications — signature-verified, then
    re-fetches the authoritative status from their API rather than
    trusting the notification body."""
    payload = await request.json()
    payment_service.handle_webhook(payload, x_signature, x_request_id, background_tasks)
