from datetime import datetime

from pydantic import BaseModel


class PaymentResponse(BaseModel):
    id: str
    loan_request_id: str
    status: str
    gross_amount: float
    platform_fee_amount: float
    pix_qr_code: str | None = None
    pix_qr_code_base64: str | None = None
    expires_at: datetime | None = None
    created_at: datetime


class MercadoPagoConnectResponse(BaseModel):
    authorization_url: str


class MercadoPagoConnectStatus(BaseModel):
    connected: bool
    connected_at: datetime | None = None


class MercadoPagoCallback(BaseModel):
    code: str
    state: str
