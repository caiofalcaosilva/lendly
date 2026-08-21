import asyncio
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError
from mongoengine.errors import ValidationError as MongoValidationError
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import assert_secrets_configured, settings
from app.database import connect_db, disconnect_db
from app.logging_config import configure_logging
from app.rate_limit import limiter
from app.routers import (
    activities,
    admin,
    auth,
    claims,
    groups,
    items,
    items_banner_slides,
    loan_requests,
    notifications,
    reports,
    reviews,
    users,
    verification,
    webhooks,
)
from app.schemas.category import CategoryResponse
from app.schemas.platform_settings import AnnouncementResponse
from app.services import category_service, platform_settings_service
from app.services.claim_overdue_service import process_overdue_claims
from app.services.review_reminder_service import send_pending_review_reminders
from app.utils.security import decode_token
from app.ws_manager import set_main_loop

configure_logging()

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    assert_secrets_configured()
    connect_db()
    # Lets sync code on any thread (e.g. activity_service.record(), called
    # from FastAPI's threadpool for sync route handlers) schedule a
    # WebSocket broadcast onto this loop — see ws_manager.broadcast_threadsafe.
    set_main_loop(asyncio.get_running_loop())

    # In-process scheduler — fine for the current single-worker deployment.
    # Would need to move to a dedicated worker (or add a distributed lock)
    # if this ever runs with more than one uvicorn process, to avoid every
    # worker sending the same reminder.
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        send_pending_review_reminders,
        CronTrigger(hour=9, minute=0),
        id="review_reminders",
    )
    scheduler.add_job(
        process_overdue_claims,
        CronTrigger(hour=9, minute=30),
        id="claim_overdue",
    )
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)
    disconnect_db()


app = FastAPI(
    title="Lendly API",
    description=(
        "Plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.FRONTEND_URL.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline response headers — CSP is deliberately left out: this API
    only ever returns JSON, and a policy tuned wrong risks breaking a
    webhook/callback flow for no real benefit here."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    return response


@app.middleware("http")
async def block_view_as_mutations(request: Request, call_next):
    """Blocks every mutating request carrying a view_as token (see
    admin_view_as_service) — keeps that mode strictly read-only."""
    if request.method not in _SAFE_METHODS:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header[7:])
                if payload.get("type") == "view_as":
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": (
                                'Modo "ver como" é somente leitura — '
                                "saia do modo pra agir de verdade"
                            )
                        },
                    )
            except JWTError:
                pass
    return await call_next(request)


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # Matches the shape of the app's regular HTTPException errors
    # ({"detail": "..."}), which both clients already know how to parse.
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas. Tente novamente em instantes."},
    )


@app.exception_handler(MongoValidationError)
def mongo_validation_handler(request: Request, exc: MongoValidationError):
    # Only reached on Document.save() — the app's dominant write path is
    # queryset .update(), which mongoengine never validates, so this is a
    # last-resort net (e.g. Report.clean()'s invariant), not the primary
    # guard against bad data — that's still the Pydantic request schemas.
    return JSONResponse(status_code=400, content={"detail": str(exc)})


os.makedirs("uploads/items", exist_ok=True)
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/groups", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# Not mounted as static — served via the authenticated endpoint in verification.py.
os.makedirs("verification_uploads", exist_ok=True)

app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(items_banner_slides.router)
app.include_router(loan_requests.router)
app.include_router(notifications.router)
app.include_router(reviews.router)
app.include_router(groups.router)
app.include_router(reports.router)
app.include_router(claims.router)
app.include_router(verification.router)
app.include_router(admin.router)
app.include_router(webhooks.router)


@app.get("/health", tags=["health"])
def health_check():
    """Liveness check — no auth, no DB access."""
    return {"status": "ok", "service": "lendly-api"}


@app.get("/config", tags=["public"])
def get_public_config():
    """Deploy-level feature flags the frontend needs before login — env-var
    backed, unlike /announcement, so a redeploy is what changes these, not
    the admin panel."""
    return {"free_lending_only": settings.FREE_LENDING_ONLY}


@app.get("/announcement", response_model=AnnouncementResponse, tags=["public"])
def get_announcement():
    """The platform-wide banner shown to every visitor, logged in or not."""
    return platform_settings_service.get_announcement()


@app.get("/categories", response_model=list[CategoryResponse], tags=["public"])
def get_categories():
    """Active item categories and subcategories, for the item creation
    form and browse filters."""
    return category_service.list_active()
