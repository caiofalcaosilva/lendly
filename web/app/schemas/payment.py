from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PaymentResponse(BaseModel):
    id: str
    loan_request_id: str
    status: str
    gross_amount: float
    platform_fee_amount: float
    pix_qr_code: Optional[str] = None
    pix_qr_code_base64: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime


class MercadoPagoConnectResponse(BaseModel):
    authorization_url: str


class MercadoPagoConnectStatus(BaseModel):
    connected: bool
    connected_at: Optional[datetime] = None


class MercadoPagoCallback(BaseModel):
    code: str
    state: str
