import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import connect_db, disconnect_db
from app.rate_limit import limiter
from app.routers import admin, auth, groups, items, loan_requests, reports, reviews, users, verification, webhooks
from app.schemas.category import CategoryResponse
from app.schemas.platform_settings import AnnouncementResponse
from app.services import category_service, platform_settings_service
from app.utils.security import decode_token

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_db()
    yield
    disconnect_db()


app = FastAPI(
    title="Lendly API",
    description="Plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def block_view_as_mutations(request: Request, call_next):
    """"Ver como" (see admin_view_as_service) issues a token carrying
    type=view_as — a single check here, ahead of every router, is enough
    to keep that whole mode strictly read-only, instead of threading a
    read-only check through every mutating endpoint individually."""
    if request.method not in _SAFE_METHODS:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header[7:])
                if payload.get("type") == "view_as":
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Modo \"ver como\" é somente leitura — saia do modo pra agir de verdade"},
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

os.makedirs("uploads/items", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# Not mounted as static — verification photos are sensitive (CPF document +
# selfie), served only via the admin-authenticated endpoint in
# routers/verification.py.
os.makedirs("verification_uploads", exist_ok=True)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(loan_requests.router)
app.include_router(reviews.router)
app.include_router(groups.router)
app.include_router(reports.router)
app.include_router(verification.router)
app.include_router(admin.router)
app.include_router(webhooks.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "lendly-api"}


@app.get("/announcement", response_model=AnnouncementResponse, tags=["public"])
def get_announcement():
    return platform_settings_service.get_announcement()


@app.get("/categories", response_model=List[CategoryResponse], tags=["public"])
def get_categories():
    return category_service.list_active()
