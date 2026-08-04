from datetime import datetime
from typing import Any, Dict

from app.models.item import Item
from app.models.message import Message
from app.models.report import Report
from app.models.review import Review
from app.models.user import User
from app.services import group_service, item_service, loan_request_service
from app.services.auth_service import user_to_response


def _report_dict(r: Report) -> Dict[str, Any]:
    return {
        "id": str(r.id),
        "target": {"type": "item", "id": str(r.item.id), "title": r.item.title} if r.item
        else {"type": "user", "id": str(r.reported_user.id), "name": r.reported_user.name},
        "reason": r.reason,
        "description": r.description,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
    }


def _message_dict(m: Message) -> Dict[str, Any]:
    return {
        "id": str(m.id),
        "request_id": str(m.request.id),
        "text": m.text,
        "created_at": m.created_at.isoformat(),
    }


def export_user_data(current_user: User) -> Dict[str, Any]:
    given_reviews = Review.objects(reviewer=current_user).order_by("-created_at")
    received_reviews = Review.objects(reviewed=current_user).order_by("-created_at")
    favorites = Item.objects(id__in=[f.id for f in (current_user.favorites or [])], is_active=True)
    filed_reports = Report.objects(reporter=current_user).order_by("-created_at")
    sent_messages = Message.objects(sender=current_user).order_by("created_at")

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "profile": user_to_response(current_user).model_dump(mode="json"),
        "items": [i.model_dump(mode="json") for i in item_service.get_user_items(str(current_user.id), current_user)],
        "loan_requests": {
            "sent": [r.model_dump(mode="json") for r in loan_request_service.get_sent_requests(current_user)],
            "received": [r.model_dump(mode="json") for r in loan_request_service.get_received_requests(current_user)],
        },
        "reviews": {
            "given": [
                {
                    "id": str(r.id), "item_title": r.loan_request.item.title,
                    "reviewed_name": r.reviewed.name, "rating": r.rating,
                    "comment": r.comment, "created_at": r.created_at.isoformat(),
                }
                for r in given_reviews
            ],
            "received": [
                {
                    "id": str(r.id), "item_title": r.loan_request.item.title,
                    "reviewer_name": r.reviewer.name, "rating": r.rating,
                    "comment": r.comment, "created_at": r.created_at.isoformat(),
                }
                for r in received_reviews
            ],
        },
        "groups": [g.model_dump(mode="json") for g in group_service.get_my_groups(current_user)],
        "favorites": [{"id": str(i.id), "title": i.title} for i in favorites],
        "reports_filed": [_report_dict(r) for r in filed_reports],
        "messages_sent": [_message_dict(m) for m in sent_messages],
    }
