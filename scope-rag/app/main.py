"""Scope RAG Service - FastAPI application."""

import logging
import os

try:
    import sentry_sdk
except ImportError:  # pragma: no cover - dependency is installed in Docker
    sentry_sdk = None

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import router
from app.security import rate_limit_middleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


def _float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return min(max(value, 0.0), 1.0)


sentry_dsn = os.environ.get("SENTRY_DSN", "")
if sentry_dsn and sentry_sdk is not None:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=_float_env("SENTRY_TRACES_SAMPLE_RATE", 0.1),
        profiles_sample_rate=_float_env("SENTRY_PROFILES_SAMPLE_RATE", 0.1),
        environment=os.environ.get("SENTRY_ENVIRONMENT") or os.environ.get("ENV", "development"),
        release=os.environ.get("SENTRY_RELEASE") or None,
        send_default_pii=False,
    )

app = FastAPI(title="Scope RAG Service", version="0.1.0")

allowed_origins = [
    origin.strip().rstrip("/")
    for origin in [settings.frontend_origin, settings.development_frontend_origin]
    if origin and origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:5173"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["authorization", "content-type", "x-correlation-id"],
)

app.middleware("http")(rate_limit_middleware)
app.include_router(router)


@app.on_event("startup")
async def startup():
    logging.getLogger(__name__).info("Scope RAG Service starting...")
    logging.getLogger(__name__).info("Scope RAG configured for model=%s", settings.ollama_model)
