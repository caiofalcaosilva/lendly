from fastapi import APIRouter, Depends

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from app.services import admin_category_service

router = APIRouter(prefix="/categories")


@router.get("", response_model=list[CategoryResponse])
def admin_list_categories(admin: User = Depends(get_current_admin)):
    """Admin — every category including inactive ones (the public
    /categories endpoint only returns active ones)."""
    return admin_category_service.list_all()


@router.post("", response_model=CategoryResponse, status_code=201)
def admin_create_category(
    data: CategoryCreate, admin: User = Depends(get_current_admin)
):
    """Admin — creates a new item category."""
    return admin_category_service.create_category(data)


@router.patch("/{key}", response_model=CategoryResponse)
def admin_update_category(
    key: str, data: CategoryUpdate, admin: User = Depends(get_current_admin)
):
    """Admin — renames or deactivates a category. Deactivating only hides
    it from new item creation; existing items keep the key."""
    return admin_category_service.update_category(key, data)


@router.post("/{key}/subcategories", response_model=CategoryResponse, status_code=201)
def admin_create_subcategory(
    key: str, data: SubcategoryCreate, admin: User = Depends(get_current_admin)
):
    """Admin — adds a subcategory under an existing category."""
    return admin_category_service.create_subcategory(key, data)


@router.patch("/{key}/subcategories/{subcategory_key}", response_model=CategoryResponse)
def admin_update_subcategory(
    key: str,
    subcategory_key: str,
    data: SubcategoryUpdate,
    admin: User = Depends(get_current_admin),
):
    """Admin — renames or deactivates a subcategory."""
    return admin_category_service.update_subcategory(key, subcategory_key, data)
