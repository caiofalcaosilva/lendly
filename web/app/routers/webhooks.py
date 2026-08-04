from fastapi import APIRouter, Header, Request

from app.services import payment_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/mercadopago", status_code=204)
async def mercadopago_webhook(
    request: Request,
    x_signature: str = Header(default=""),
    x_request_id: str = Header(default=""),
):
    payload = await request.json()
    payment_service.handle_webhook(payload, x_signature, x_request_id)
