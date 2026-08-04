from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile

from app.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.services import item_service

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=List[ItemResponse])
def list_items(
    search: Optional[str] = Query(None, description="Full-text search over title and description"),
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    availability_type: Optional[str] = Query(None, pattern="^(free|paid)$"),
    neighborhood: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(16, ge=1, le=100),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None, ge=0.1),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    return item_service.list_items(
        search=search,
        category=category,
        subcategory=subcategory,
        availability_type=availability_type,
        neighborhood=neighborhood,
        city=city,
        skip=skip,
        limit=limit,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        current_user=current_user,
    )


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    return item_service.get_item(item_id, current_user)


@router.post("/", response_model=ItemResponse, status_code=201)
def create_item(data: ItemCreate, current_user: User = Depends(get_current_user)):
    return item_service.create_item(data, current_user)


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(item_id: str, data: ItemUpdate, current_user: User = Depends(get_current_user)):
    return item_service.update_item(item_id, data, current_user)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    item_service.delete_item(item_id, current_user)


@router.patch("/{item_id}/activate", response_model=ItemResponse)
def activate(
    item_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    return item_service.set_availability(item_id, True, current_user, background_tasks)


@router.patch("/{item_id}/deactivate", response_model=ItemResponse)
def deactivate(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_availability(item_id, False, current_user)


@router.post("/{item_id}/favorite", response_model=ItemResponse)
def favorite_item(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_favorite(item_id, current_user, True)


@router.delete("/{item_id}/favorite", response_model=ItemResponse)
def unfavorite_item(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_favorite(item_id, current_user, False)


@router.post("/{item_id}/waitlist", response_model=ItemResponse)
def join_waitlist(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_waitlist(item_id, current_user, True)


@router.delete("/{item_id}/waitlist", response_model=ItemResponse)
def leave_waitlist(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_waitlist(item_id, current_user, False)


@router.post("/{item_id}/photos", response_model=ItemResponse, status_code=201)
async def upload_photo(
    item_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    return await item_service.upload_photo(item_id, file, current_user)
