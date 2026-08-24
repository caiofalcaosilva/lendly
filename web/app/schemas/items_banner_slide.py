from pydantic import BaseModel, Field


class ItemsBannerSlideResponse(BaseModel):
    id: str
    image_url: str
    image_url_mobile: str | None = None
    link_url: str | None = None
    order: int


class ItemsBannerSlideUpdate(BaseModel):
    link_url: str | None = Field(None, max_length=500)


class ItemsBannerSlideReorder(BaseModel):
    slide_ids: list[str]
