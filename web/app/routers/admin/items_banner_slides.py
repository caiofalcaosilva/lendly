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
    file_mobile: UploadFile | None = File(None),
    link_url: str | None = Form(None),
    admin: User = Depends(get_current_admin),
):
    """Admin — uploads a carousel slide: the required desktop image, plus
    an optional mobile-specific one (resized, EXIF-stripped either way).
    Capped at MAX_SLIDES. Appends at the end of the current order."""
    return await items_banner_slide_service.create_slide(file, file_mobile, link_url)


@router.patch("/{slide_id}", response_model=ItemsBannerSlideResponse)
def update_slide(
    slide_id: str,
    data: ItemsBannerSlideUpdate,
    admin: User = Depends(get_current_admin),
):
    """Admin — edits a slide's link without re-uploading either image."""
    return items_banner_slide_service.update_slide(slide_id, data.link_url)


@router.post("/{slide_id}/image", response_model=ItemsBannerSlideResponse)
async def replace_image(
    slide_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin),
):
    """Admin — re-uploads a slide's desktop image, leaving its mobile
    image (if any) and link untouched."""
    return await items_banner_slide_service.replace_image(slide_id, file)


@router.post("/{slide_id}/image-mobile", response_model=ItemsBannerSlideResponse)
async def replace_mobile_image(
    slide_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin),
):
    """Admin — adds or re-uploads a slide's mobile-specific image."""
    return await items_banner_slide_service.replace_mobile_image(slide_id, file)


@router.delete("/{slide_id}/image-mobile", response_model=ItemsBannerSlideResponse)
def remove_mobile_image(slide_id: str, admin: User = Depends(get_current_admin)):
    """Admin — clears a slide's mobile-specific image; it falls back to
    the desktop image on mobile again."""
    return items_banner_slide_service.remove_mobile_image(slide_id)


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
