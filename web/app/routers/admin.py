from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response

from app.dependencies import get_current_admin
from app.models.user import User
from app.schemas.admin_actions import AdminActionEntry
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.schemas.admin_items import AdminItemSummary
from app.schemas.admin_users import AdminUserSummary
from app.schemas.bulk import BulkActionRequest, BulkActionResult
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate, SubcategoryCreate, SubcategoryUpdate
from app.schemas.group import GroupResponse, GroupSummary
from app.schemas.platform_settings import PlatformSettingsResponse, PlatformSettingsUpdate
from app.schemas.view_as import ViewAsResponse
from app.services import (
    admin_action_service,
    admin_category_service,
    admin_dashboard_service,
    admin_export_service,
    admin_item_service,
    admin_review_service,
    admin_user_service,
    admin_view_as_service,
    group_service,
    platform_settings_service,
)


def _csv_response(content: str, name: str) -> Response:
    filename = f"lendly-{name}-{date.today().isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardSummary)
def get_dashboard(admin: User = Depends(get_current_admin)):
    return admin_dashboard_service.get_admin_dashboard()


@router.get("/users", response_model=List[AdminUserSummary])
def list_users(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
):
    return admin_user_service.list_users(search, skip, limit)


@router.get("/users/{user_id}", response_model=AdminUserSummary)
def get_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_user_service.get_user(user_id)


@router.patch("/users/{user_id}/deactivate", response_model=AdminUserSummary)
def deactivate_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_user_service.deactivate_user(user_id, admin)


@router.patch("/users/{user_id}/activate", response_model=AdminUserSummary)
def activate_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_user_service.activate_user(user_id, admin)


@router.post("/users/bulk-activate", response_model=BulkActionResult)
def bulk_activate_users(data: BulkActionRequest, admin: User = Depends(get_current_admin)):
    return admin_user_service.bulk_activate_users(data.ids, admin)


@router.post("/users/bulk-deactivate", response_model=BulkActionResult)
def bulk_deactivate_users(data: BulkActionRequest, admin: User = Depends(get_current_admin)):
    return admin_user_service.bulk_deactivate_users(data.ids, admin)


@router.patch("/users/{user_id}/promote", response_model=AdminUserSummary)
def promote_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_user_service.promote_user(user_id, admin)


@router.patch("/users/{user_id}/demote", response_model=AdminUserSummary)
def demote_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_user_service.demote_user(user_id, admin)


@router.post("/users/{user_id}/view-as", response_model=ViewAsResponse)
def view_as_user(user_id: str, admin: User = Depends(get_current_admin)):
    return admin_view_as_service.create_view_as_token(admin, user_id)


@router.get("/items", response_model=List[AdminItemSummary])
def list_items(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
):
    return admin_item_service.list_items(search, skip, limit)


@router.get("/items/{item_id}", response_model=AdminItemSummary)
def get_item(item_id: str, admin: User = Depends(get_current_admin)):
    return admin_item_service.get_item(item_id)


@router.patch("/items/{item_id}/deactivate", response_model=AdminItemSummary)
def deactivate_item(item_id: str, admin: User = Depends(get_current_admin)):
    return admin_item_service.deactivate_item(item_id, admin)


@router.patch("/items/{item_id}/activate", response_model=AdminItemSummary)
def activate_item(item_id: str, admin: User = Depends(get_current_admin)):
    return admin_item_service.activate_item(item_id, admin)


@router.post("/items/bulk-activate", response_model=BulkActionResult)
def bulk_activate_items(data: BulkActionRequest, admin: User = Depends(get_current_admin)):
    return admin_item_service.bulk_activate_items(data.ids, admin)


@router.post("/items/bulk-deactivate", response_model=BulkActionResult)
def bulk_deactivate_items(data: BulkActionRequest, admin: User = Depends(get_current_admin)):
    return admin_item_service.bulk_deactivate_items(data.ids, admin)


@router.get("/actions", response_model=List[AdminActionEntry])
def get_actions(limit: int = Query(50, ge=1, le=100), admin: User = Depends(get_current_admin)):
    return admin_action_service.get_admin_actions(limit)


@router.get("/settings", response_model=PlatformSettingsResponse)
def get_platform_settings(admin: User = Depends(get_current_admin)):
    return platform_settings_service.get_settings_response()


@router.patch("/settings", response_model=PlatformSettingsResponse)
def update_platform_settings(
    data: PlatformSettingsUpdate, admin: User = Depends(get_current_admin)
):
    return platform_settings_service.update_settings(data, admin)


@router.get("/groups", response_model=List[GroupSummary])
def list_all_groups(admin: User = Depends(get_current_admin)):
    return group_service.list_all_groups()


@router.delete("/groups/{group_id}", status_code=204)
def admin_delete_group(group_id: str, admin: User = Depends(get_current_admin)):
    group_service.admin_delete_group(group_id)


@router.delete("/groups/{group_id}/members/{user_id}", response_model=GroupResponse)
def admin_remove_member(group_id: str, user_id: str, admin: User = Depends(get_current_admin)):
    return group_service.admin_remove_member(group_id, user_id)


@router.delete("/reviews/{review_id}", status_code=204)
def admin_delete_review(review_id: str, admin: User = Depends(get_current_admin)):
    admin_review_service.admin_delete_review(review_id)


@router.get("/export/users")
def export_users(admin: User = Depends(get_current_admin)):
    return _csv_response(admin_export_service.export_users_csv(), "usuarios")


@router.get("/export/items")
def export_items(admin: User = Depends(get_current_admin)):
    return _csv_response(admin_export_service.export_items_csv(), "itens")


@router.get("/export/loan-requests")
def export_loan_requests(admin: User = Depends(get_current_admin)):
    return _csv_response(admin_export_service.export_loan_requests_csv(), "emprestimos")


@router.get("/categories", response_model=List[CategoryResponse])
def admin_list_categories(admin: User = Depends(get_current_admin)):
    return admin_category_service.list_all()


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def admin_create_category(data: CategoryCreate, admin: User = Depends(get_current_admin)):
    return admin_category_service.create_category(data)


@router.patch("/categories/{key}", response_model=CategoryResponse)
def admin_update_category(key: str, data: CategoryUpdate, admin: User = Depends(get_current_admin)):
    return admin_category_service.update_category(key, data)


@router.post("/categories/{key}/subcategories", response_model=CategoryResponse, status_code=201)
def admin_create_subcategory(key: str, data: SubcategoryCreate, admin: User = Depends(get_current_admin)):
    return admin_category_service.create_subcategory(key, data)


@router.patch("/categories/{key}/subcategories/{subcategory_key}", response_model=CategoryResponse)
def admin_update_subcategory(
    key: str, subcategory_key: str, data: SubcategoryUpdate, admin: User = Depends(get_current_admin)
):
    return admin_category_service.update_subcategory(key, subcategory_key, data)
