from pydantic import BaseModel, Field


class SubcategoryResponse(BaseModel):
    key: str
    label: str
    is_active: bool = True


class CategoryResponse(BaseModel):
    key: str
    label: str
    is_active: bool = True
    subcategories: list[SubcategoryResponse] = []


class CategoryCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    label: str = Field(..., min_length=1, max_length=100)


class CategoryUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None


class SubcategoryCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    label: str = Field(..., min_length=1, max_length=100)


class SubcategoryUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None
