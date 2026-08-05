from datetime import datetime

from pydantic import BaseModel


class ItemAnalytics(BaseModel):
    item_id: str
    title: str
    category: str
    times_borrowed: int
    revenue: float
    occupancy_rate: float


class OwnerAnalyticsSummary(BaseModel):
    total_items: int
    total_loans: int
    total_revenue: float
    average_occupancy_rate: float
    most_popular_item: str | None = None
    items: list[ItemAnalytics]


class SpendingEntry(BaseModel):
    loan_request_id: str
    item_title: str
    amount: float
    status: str
    created_at: datetime


class RequesterSpendingSummary(BaseModel):
    total_spent: float
    payments_count: int
    payments: list[SpendingEntry]
