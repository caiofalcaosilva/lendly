from datetime import datetime

from pydantic import BaseModel


class AdminActionEntry(BaseModel):
    action_type: str  # e.g. "user_promoted", "item_deactivated", "report_dismissed"
    actor_name: str
    target_label: str
    target_id: str
    target_kind: str  # user | item
    detail: str | None = None
    occurred_at: datetime
