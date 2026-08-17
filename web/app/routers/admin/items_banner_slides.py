from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.items_banner_slide import (
    ItemsBannerSlideReorder,
    ItemsBannerSlideResponse,
    ItemsBannerSlideUpdate,
)
from app.services import items_banner_slide_service

router = APIRouter(prefix="/items-banner-slides")


@router.post("", response_model=ItemsBannerSlideResponse, status_code=201)
async def create_slide(
    file: UploadFile = File(...),
    link_url: str | None = Form(None),
    admin: User = Depends(get_current_admin),
):
    """Admin — uploads one carousel image (resized, EXIF-stripped), capped
    at MAX_SLIDES. Appends at the end of the current order."""
    return await items_banner_slide_service.create_slide(file, link_url)


@router.patch("/{slide_id}", response_model=ItemsBannerSlideResponse)
def update_slide(
    slide_id: str,
    data: ItemsBannerSlideUpdate,
    admin: User = Depends(get_current_admin),
):
    """Admin — edits a slide's link without re-uploading the image."""
    return items_banner_slide_service.update_slide(slide_id, data.link_url)


@router.delete("/{slide_id}", status_code=204)
def delete_slide(slide_id: str, admin: User = Depends(get_current_admin)):
    """Admin — removes a slide from the carousel."""
    items_banner_slide_service.delete_slide(slide_id)


@router.put("/reorder", response_model=list[ItemsBannerSlideResponse])
def reorder_slides(
    data: ItemsBannerSlideReorder, admin: User = Depends(get_current_admin)
):
    """Admin — sets the carousel order to match the given id sequence."""
    return items_banner_slide_service.reorder_slides(data.slide_ids)
