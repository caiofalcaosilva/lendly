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
from app.schemas.loan_request import (
    LoanRequestConfirmCode,
    LoanRequestCreate,
    LoanRequestExtend,
    LoanRequestResponse,
)
from app.schemas.message import MessageCreate, MessageResponse
from app.schemas.payment import PaymentResponse
from app.services import loan_request_service, message_service, payment_service
from app.services.platform_settings_service import get_settings as get_platform_settings
from app.utils.security import decode_token
from app.ws_manager import manager

router = APIRouter(prefix="/requests", tags=["loan_requests"])


@router.post("/", response_model=LoanRequestResponse, status_code=201)
def create_request(
    data: LoanRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Requests to borrow an item — starts in 'pending', awaiting the
    owner's accept/refuse. Notifies the owner."""
    return loan_request_service.create_request(data, current_user, background_tasks)


@router.get("/{request_id}", response_model=LoanRequestResponse)
def get_request(request_id: str, current_user: User = Depends(get_current_user)):
    """A single loan request's detail — visible to its owner or requester
    only."""
    return loan_request_service.get_request(request_id, current_user)


@router.patch("/{request_id}/accept", response_model=LoanRequestResponse)
def accept(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner accepts a pending request. For paid items, this is also when
    the Pix charge is created."""
    return loan_request_service.accept_request(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/refuse", response_model=LoanRequestResponse)
def refuse(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner declines a pending request."""
    return loan_request_service.refuse_request(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/start", response_model=LoanRequestResponse)
def start(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Either side confirms pickup. Only moves to 'in_progress' once BOTH
    the owner and the requester have confirmed — for paid items, also
    blocked until the Pix payment has been confirmed."""
    return loan_request_service.confirm_pickup(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/start/force", response_model=LoanRequestResponse)
def force_start(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner-only escape hatch: forces the pickup through without the
    requester's confirmation, once the grace period since the owner's own
    confirmation has elapsed. Flags the request as pickup_forced."""
    return loan_request_service.force_pickup(request_id, current_user, background_tasks)


@router.patch("/{request_id}/start/code", response_model=LoanRequestResponse)
def confirm_start_code(
    request_id: str,
    data: LoanRequestConfirmCode,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner-only, delivery-fulfilled requests only: the code the requester
    was shown, typed in by the owner, completes pickup for both sides at
    once — full substitute for /start on delivery requests."""
    return loan_request_service.confirm_pickup_by_code(
        request_id, current_user, data.code, background_tasks
    )


@router.patch("/{request_id}/start/code/regenerate", response_model=LoanRequestResponse)
def regenerate_start_code(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner-only: issues a fresh delivery code and resets the attempt
    counter, used after the wrong-code cap is hit."""
    return loan_request_service.regenerate_delivery_code(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/finish", response_model=LoanRequestResponse)
def finish(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Either side confirms the item's return. Only closes out the loan
    once BOTH the owner and the requester have confirmed."""
    return loan_request_service.confirm_return(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/finish/force", response_model=LoanRequestResponse)
def force_finish(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner-only escape hatch for the return side — same grace-period
    rule as /start/force. Flags the request as return_forced."""
    return loan_request_service.force_return(request_id, current_user, background_tasks)


@router.patch("/{request_id}/cancel", response_model=LoanRequestResponse)
def cancel(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Either party cancels before pickup. Only allowed while 'pending' or
    'accepted' — a held payment is fully refunded."""
    return loan_request_service.cancel_request(
        request_id, current_user, background_tasks
    )


@router.get("/{request_id}/payment", response_model=PaymentResponse)
def get_payment(request_id: str, current_user: User = Depends(get_current_user)):
    """The Pix payment for a paid request — includes the QR code to pay
    with. Retries the charge if the initial attempt failed."""
    return payment_service.get_payment_for_request(request_id, current_user)


@router.get("/{request_id}/extension-payment", response_model=PaymentResponse)
def get_extension_payment(
    request_id: str, current_user: User = Depends(get_current_user)
):
    """The most recent extension charge for this request, if any — created
    automatically when the owner approves a prorrogação on a paid item."""
    return payment_service.get_extension_payment_for_request(request_id, current_user)


@router.get("/{request_id}/claim-payment", response_model=PaymentResponse)
def get_claim_payment(request_id: str, current_user: User = Depends(get_current_user)):
    """The active claim charge for this request, if any — the requester ->
    owner charge, or the requester -> platform debt charge once the
    platform has advanced an overdue paid-item claim's owner."""
    return payment_service.get_claim_payment_for_request(request_id, current_user)


@router.post(
    "/{request_id}/extend", response_model=LoanRequestResponse, status_code=201
)
def extend(
    request_id: str,
    data: LoanRequestExtend,
    current_user: User = Depends(get_current_user),
):
    """Requester asks to push back the return date on an in-progress loan —
    awaits the owner's approval."""
    return loan_request_service.request_extension(request_id, data, current_user)


@router.patch("/{request_id}/extension/approve", response_model=LoanRequestResponse)
def approve_extension(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner approves a pending extension, pushing back
    expected_return_date."""
    return loan_request_service.approve_extension(
        request_id, current_user, background_tasks
    )


@router.patch("/{request_id}/extension/reject", response_model=LoanRequestResponse)
def reject_extension(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Owner rejects a pending extension — the original return date
    stands."""
    return loan_request_service.reject_extension(
        request_id, current_user, background_tasks
    )


# ── Chat ─────────────────────────────────────────────────────────────────────


@router.get("/{request_id}/messages", response_model=list[MessageResponse])
def list_messages(request_id: str, current_user: User = Depends(get_current_user)):
    """Full chat history for a loan request — participants only."""
    return message_service.list_messages(request_id, current_user)


@router.post("/{request_id}/messages", response_model=MessageResponse, status_code=201)
@limiter.limit(
    lambda: f"{get_platform_settings().chat_message_rate_limit_per_minute}/minute"
)
def send_message(
    request_id: str,
    data: MessageCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Sends a chat message on a loan request — broadcast live to the other
    participant over the /ws socket if they're connected."""
    return message_service.send_message(
        request_id, current_user, data.text, background_tasks
    )


@router.websocket("/{request_id}/ws")
async def messages_ws(websocket: WebSocket, request_id: str, token: str):
    """Live chat socket for a loan request. Auth via `?token=` query param
    (browsers can't set headers on a WS handshake) — closes with 4401 if
    the token doesn't belong to a participant."""
    is_participant = False
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        user = User.objects(id=user_id, is_active=True).first() if user_id else None
        req = LoanRequest.objects(id=request_id).first() if user else None
        if user and req:
            is_participant = str(req.requester.id) == str(user.id) or str(
                req.owner.id
            ) == str(user.id)
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
