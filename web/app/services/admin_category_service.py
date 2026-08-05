from fastapi import HTTPException, status

from app.models.category import Category, Subcategory
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from app.services.category_service import list_all, to_response


def _get_category(key: str) -> Category:
    category = Category.objects(key=key).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return category


def create_category(data: CategoryCreate) -> CategoryResponse:
    if Category.objects(key=data.key).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Category key already exists"
        )
    category = Category(key=data.key, label=data.label)
    category.save()
    return to_response(category)


def update_category(key: str, data: CategoryUpdate) -> CategoryResponse:
    category = _get_category(key)
    updates = data.model_dump(exclude_none=True)
    if updates:
        category.update(**updates)
        category.reload()
    return to_response(category)


def create_subcategory(category_key: str, data: SubcategoryCreate) -> CategoryResponse:
    category = _get_category(category_key)
    if any(s.key == data.key for s in category.subcategories):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Subcategory key already exists",
        )
    category.update(push__subcategories=Subcategory(key=data.key, label=data.label))
    category.reload()
    return to_response(category)


def update_subcategory(
    category_key: str, subcategory_key: str, data: SubcategoryUpdate
) -> CategoryResponse:
    category = _get_category(category_key)
    sub = next((s for s in category.subcategories if s.key == subcategory_key), None)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subcategory not found"
        )
    if data.label is not None:
        sub.label = data.label
    if data.is_active is not None:
        sub.is_active = data.is_active
    category.save()
    return to_response(category)


__all__ = [
    "create_category",
    "update_category",
    "create_subcategory",
    "update_subcategory",
    "list_all",
]
