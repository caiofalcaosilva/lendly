from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, disconnect_db
from app.routers import auth, items, loan_requests, reviews, users


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

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(items.router)
app.include_router(loan_requests.router)
app.include_router(reviews.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "lendly-api"}
