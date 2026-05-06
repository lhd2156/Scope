from __future__ import annotations

import os
from collections.abc import Callable
from typing import Any, TypeVar

from flask_sqlalchemy import SQLAlchemy

try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
except ImportError:  # pragma: no cover - dependency is installed in Docker
    Limiter = None
    get_remote_address = None

RouteHandler = TypeVar("RouteHandler", bound=Callable[..., Any])

db = SQLAlchemy()


class _NoopLimiter:
    def init_app(self, app) -> None:
        return None

    def limit(self, *args, **kwargs):
        def decorator(handler: RouteHandler) -> RouteHandler:
            return handler

        return decorator


def _limiter_storage_uri() -> str:
    storage_uri = os.getenv("INTEL_RATE_LIMIT_STORAGE_URI", "redis://redis:6379/3")
    if storage_uri.startswith("redis"):
        try:
            import redis  # noqa: F401
        except ImportError:
            return "memory://"
    return storage_uri


limiter = (
    Limiter(
        key_func=get_remote_address,
        default_limits=["100/minute"],
        storage_uri=_limiter_storage_uri(),
    )
    if Limiter is not None and get_remote_address is not None
    else _NoopLimiter()
)
