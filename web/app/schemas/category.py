from typing import List, Optional

from pydantic import BaseModel, Field


class SubcategoryResponse(BaseModel):
    key: str
    label: str
    is_active: bool = True


class CategoryResponse(BaseModel):
    key: str
    label: str
    is_active: bool = True
    subcategories: List[SubcategoryResponse] = []


class CategoryCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    label: str = Field(..., min_length=1, max_length=100)


class CategoryUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


class SubcategoryCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    label: str = Field(..., min_length=1, max_length=100)


class SubcategoryUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
