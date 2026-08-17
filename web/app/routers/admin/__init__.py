"""Split by resource across this package's modules — aggregated here into
the single `router` main.py mounts, same prefix and paths as before the
split (see each submodule for its slice of the 31 admin routes)."""

from fastapi import APIRouter

from app.routers.admin import (
    actions,
    activities,
    categories,
    dashboard,
    exports,
    groups,
    items,
    items_banner_slides,
    reviews,
    settings,
    users,
)

router = APIRouter(prefix="/admin", tags=["admin"])

router.include_router(dashboard.router)
router.include_router(users.router)
router.include_router(items.router)
router.include_router(actions.router)
router.include_router(settings.router)
router.include_router(items_banner_slides.router)
router.include_router(groups.router)
router.include_router(reviews.router)
router.include_router(exports.router)
router.include_router(categories.router)
router.include_router(activities.router)
