from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from jose import JWTError

from app.dependencies import get_current_user
from app.models.loan_request import LoanRequest
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.loan_request import LoanRequestCreate, LoanRequestExtend, LoanRequestResponse
from app.schemas.message import MessageCreate, MessageResponse
from app.schemas.payment import PaymentResponse
from app.services import loan_request_service, message_service, payment_service
from app.utils.security import decode_token
from app.ws_manager import manager

router = APIRouter(prefix="/requests", tags=["loan_requests"])


@router.post("/", response_model=LoanRequestResponse, status_code=201)
def create_request(data: LoanRequestCreate, current_user: User = Depends(get_current_user)):
    return loan_request_service.create_request(data, current_user)


@router.get("/{request_id}", response_model=LoanRequestResponse)
def get_request(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.get_request(request_id, current_user)


@router.patch("/{request_id}/accept", response_model=LoanRequestResponse)
def accept(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    return loan_request_service.accept_request(request_id, current_user, background_tasks)


@router.patch("/{request_id}/refuse", response_model=LoanRequestResponse)
def refuse(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    return loan_request_service.refuse_request(request_id, current_user, background_tasks)


@router.patch("/{request_id}/start", response_model=LoanRequestResponse)
def start(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.start_request(request_id, current_user)


@router.patch("/{request_id}/finish", response_model=LoanRequestResponse)
def finish(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    return loan_request_service.finish_request(request_id, current_user, background_tasks)


@router.patch("/{request_id}/cancel", response_model=LoanRequestResponse)
def cancel(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.cancel_request(request_id, current_user)


@router.get("/{request_id}/payment", response_model=PaymentResponse)
def get_payment(request_id: str, current_user: User = Depends(get_current_user)):
    return payment_service.get_payment_for_request(request_id, current_user)


@router.post("/{request_id}/extend", response_model=LoanRequestResponse, status_code=201)
def extend(
    request_id: str, data: LoanRequestExtend, current_user: User = Depends(get_current_user)
):
    return loan_request_service.request_extension(request_id, data, current_user)


@router.patch("/{request_id}/extension/approve", response_model=LoanRequestResponse)
def approve_extension(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.approve_extension(request_id, current_user)


@router.patch("/{request_id}/extension/reject", response_model=LoanRequestResponse)
def reject_extension(request_id: str, current_user: User = Depends(get_current_user)):
    return loan_request_service.reject_extension(request_id, current_user)


# ── Chat ─────────────────────────────────────────────────────────────────────

@router.get("/{request_id}/messages", response_model=List[MessageResponse])
def list_messages(request_id: str, current_user: User = Depends(get_current_user)):
    return message_service.list_messages(request_id, current_user)


@router.post("/{request_id}/messages", response_model=MessageResponse, status_code=201)
@limiter.limit("20/minute")
def send_message(
    request_id: str,
    data: MessageCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    return message_service.send_message(request_id, current_user, data.text, background_tasks)


@router.websocket("/{request_id}/ws")
async def messages_ws(websocket: WebSocket, request_id: str, token: str):
    is_participant = False
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        user = User.objects(id=user_id, is_active=True).first() if user_id else None
        req = LoanRequest.objects(id=request_id).first() if user else None
        if user and req:
            is_participant = str(req.requester.id) == str(user.id) or str(req.owner.id) == str(
                user.id
            )
    except JWTError:
        is_participant = False

    if not is_participant:
        await websocket.close(code=4401)
        return

    await manager.connect(request_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(request_id, websocket)
