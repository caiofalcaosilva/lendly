from fastapi import BackgroundTasks

from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageResponse
from app.services import email_service, loan_request_service
from app.ws_manager import manager

PAGE_SIZE = 50


def _to_response(msg: Message) -> MessageResponse:
    return MessageResponse(
        id=str(msg.id),
        request_id=str(msg.request.id),
        sender_id=str(msg.sender.id),
        sender_name=msg.sender.name,
        text=msg.text,
        created_at=msg.created_at,
    )


def send_message(
    request_id: str, current_user: User, text: str, background_tasks: BackgroundTasks
) -> MessageResponse:
    req = loan_request_service._get_as_participant(request_id, current_user)

    msg = Message(request=req, sender=current_user, text=text)
    msg.save()
    response = _to_response(msg)

    background_tasks.add_task(
        manager.broadcast, request_id, response.model_dump(mode="json")
    )

    recipient = (
        req.owner if str(req.requester.id) == str(current_user.id) else req.requester
    )
    background_tasks.add_task(
        email_service.send_new_message_email,
        recipient.email,
        recipient.name,
        current_user.name,
        req.item.title,
        request_id,
    )

    return response


def list_messages(request_id: str, current_user: User) -> list[MessageResponse]:
    req = loan_request_service._get_as_participant(request_id, current_user)
    msgs = Message.objects(request=req).order_by("-created_at").limit(PAGE_SIZE)
    return [_to_response(m) for m in reversed(list(msgs))]
