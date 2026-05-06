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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

sentry_dsn = os.environ.get("SENTRY_DSN", "")
if sentry_dsn and sentry_sdk is not None:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.1,
        environment=os.environ.get("ENV", "development"),
        send_default_pii=False,
    )

app = FastAPI(title="Scope RAG Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup():
    logging.getLogger(__name__).info("Scope RAG Service starting...")
    logging.getLogger(__name__).info("Scope RAG configured for model=%s", settings.ollama_model)
