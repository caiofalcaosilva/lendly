from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int


class MarkAllReadResponse(BaseModel):
    marked: int


class ClearReadResponse(BaseModel):
    cleared: int


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str
