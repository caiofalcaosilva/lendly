from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.services import item_service

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=List[ItemResponse])
def list_items(
    search: Optional[str] = Query(None, description="Search by title"),
    category: Optional[str] = Query(None),
    availability_type: Optional[str] = Query(None, pattern="^(free|paid)$"),
    neighborhood: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(16, ge=1, le=100),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None, ge=0.1),
):
    return item_service.list_items(
        search, category, availability_type, neighborhood, city, skip, limit, lat, lng, radius_km
    )


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: str):
    return item_service.get_item(item_id)


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
def activate(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_availability(item_id, True, current_user)


@router.patch("/{item_id}/deactivate", response_model=ItemResponse)
def deactivate(item_id: str, current_user: User = Depends(get_current_user)):
    return item_service.set_availability(item_id, False, current_user)
