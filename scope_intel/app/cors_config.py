from __future__ import annotations

from flask import Flask
from flask_cors import CORS

DEFAULT_DEVELOPMENT_ORIGIN = "http://localhost:5173"
ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
ALLOWED_HEADERS = ["Authorization", "Content-Type", "X-Requested-With", "X-SignalR-User-Agent"]


def _allowed_origins(app: Flask) -> list[str]:
    configured_origin = app.config.get("FRONTEND_ORIGIN")
    origins: list[str] = [configured_origin] if configured_origin else []

    if app.config.get("FLASK_ENV") == "development" or app.config.get("TESTING"):
        development_origin = app.config.get("DEVELOPMENT_FRONTEND_ORIGIN", DEFAULT_DEVELOPMENT_ORIGIN)
        if development_origin not in origins:
            origins.append(development_origin)

    return origins


def configure_cors(app: Flask) -> None:
    origins = _allowed_origins(app)
    if not origins:
        raise RuntimeError("Missing required Intel configuration: FRONTEND_ORIGIN")

    CORS(
        app,
        resources={
            r"/api/intel/*": {
                "origins": origins,
                "methods": ALLOWED_METHODS,
                "allow_headers": ALLOWED_HEADERS,
                "supports_credentials": True,
            }
        },
    )
