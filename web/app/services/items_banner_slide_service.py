import uuid

from fastapi import UploadFile

from app.models.items_banner_slide import ItemsBannerSlide
from app.schemas.items_banner_slide import ItemsBannerSlideResponse
from app.services import storage
from app.utils import errors
from app.utils.images import load_and_resize
from app.utils.time import utcnow

MAX_SLIDES = 8


def _to_response(doc: ItemsBannerSlide) -> ItemsBannerSlideResponse:
    return ItemsBannerSlideResponse(
        id=str(doc.id),
        image_url=doc.image_url,
        link_url=doc.link_url,
        order=doc.order,
    )


def list_slides() -> list[ItemsBannerSlideResponse]:
    """Public, unauthenticated — the ordered carousel shown on the items
    page. Admin management (upload/reorder/edit/delete) lives under
    /admin/items-banner-slides."""
    return [_to_response(d) for d in ItemsBannerSlide.objects().order_by("order")]


async def create_slide(
    file: UploadFile, link_url: str | None
) -> ItemsBannerSlideResponse:
    count = ItemsBannerSlide.objects().count()
    if count >= MAX_SLIDES:
        raise errors.bad_request(f"Máximo de {MAX_SLIDES} slides no carrossel")

    img = await load_and_resize(file)
    key = f"items-banner/{uuid.uuid4().hex}.jpg"
    url = storage.save_public_image(img, key)

    doc = ItemsBannerSlide(image_url=url, link_url=link_url or None, order=count)
    doc.save()
    return _to_response(doc)


def update_slide(slide_id: str, link_url: str | None) -> ItemsBannerSlideResponse:
    doc = ItemsBannerSlide.objects(id=slide_id).first()
    if not doc:
        raise errors.not_found("Slide não encontrado")
    doc.update(link_url=link_url or None, updated_at=utcnow())
    doc.reload()
    return _to_response(doc)


def delete_slide(slide_id: str) -> None:
    doc = ItemsBannerSlide.objects(id=slide_id).first()
    if not doc:
        raise errors.not_found("Slide não encontrado")
    doc.delete()


def reorder_slides(slide_ids: list[str]) -> list[ItemsBannerSlideResponse]:
    docs = {str(d.id): d for d in ItemsBannerSlide.objects(id__in=slide_ids)}
    if set(docs.keys()) != set(slide_ids):
        raise errors.bad_request("Lista de slides inválida")
    for index, slide_id in enumerate(slide_ids):
        docs[slide_id].update(order=index, updated_at=utcnow())
    return list_slides()
