from fastapi import APIRouter

from app.schemas.items_banner_slide import ItemsBannerSlideResponse
from app.services import items_banner_slide_service

router = APIRouter(prefix="/items-banner-slides", tags=["public"])


@router.get("", response_model=list[ItemsBannerSlideResponse])
def list_items_banner_slides():
    """Public, unauthenticated — the ordered promotional carousel shown on
    the items/browse page. Management lives under
    /admin/items-banner-slides."""
    return items_banner_slide_service.list_slides()
