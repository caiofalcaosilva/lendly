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
