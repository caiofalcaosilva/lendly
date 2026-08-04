from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AdminActionEntry(BaseModel):
    action_type: str  # report_dismissed | report_actioned | verification_approved | verification_rejected | user_activated | user_deactivated | item_activated | item_deactivated | user_promoted | user_demoted
    actor_name: str
    target_label: str
    target_id: str
    target_kind: str  # user | item
    detail: Optional[str] = None
    occurred_at: datetime
