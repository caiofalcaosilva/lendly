from datetime import datetime

from pydantic import BaseModel


class ActivityActor(BaseModel):
    id: str
    name: str


class ActivityResource(BaseModel):
    type: str
    id: str
    title: str | None = None


class ActivityResponse(BaseModel):
    id: str
    event: str
    actor: ActivityActor | None = None
    resource: ActivityResource
    metadata: dict = {}
    created_at: datetime
