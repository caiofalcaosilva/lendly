from typing import List

from pydantic import BaseModel


class WeeklySignups(BaseModel):
    week_start: str
    count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class CityCount(BaseModel):
    city: str
    count: int


class AdminDashboardSummary(BaseModel):
    total_users: int
    total_items: int
    active_items: int
    loans_pending: int
    loans_in_progress: int
    loans_finished: int
    loans_cancelled_or_refused: int
    pending_reports: int
    pending_verifications: int
    signups_last_8_weeks: List[WeeklySignups]
    top_categories: List[CategoryCount]
    top_cities: List[CityCount]
