from datetime import datetime

from pydantic import BaseModel


class AdminActionEntry(BaseModel):
    # report_dismissed | report_actioned | verification_approved | verification_rejected
    # | user_activated | user_deactivated | item_activated | item_deactivated
    # | user_promoted | user_demoted
    action_type: str
    actor_name: str
    target_label: str
    target_id: str
    target_kind: str  # user | item
    detail: str | None = None
    occurred_at: datetime
