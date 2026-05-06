from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from flask import current_app, g, request

from app.responses import error_response

RouteHandler = TypeVar("RouteHandler", bound=Callable[..., Any])
WINDOW_SECONDS = 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limit_state() -> None:
    _request_windows.clear()


def _client_key() -> str:
    return request.headers.get("Authorization") or request.remote_addr or "anonymous"


def rate_limited(handler: RouteHandler) -> RouteHandler:
    @wraps(handler)
    def wrapper(*args: Any, **kwargs: Any):
        limit = int(current_app.config["RATE_LIMIT_PER_MINUTE"])
        now = time.time()
        window = _request_windows[_client_key()]

        while window and now - window[0] >= WINDOW_SECONDS:
            window.popleft()

        if len(window) >= limit:
            retry_after = max(1, math.ceil(WINDOW_SECONDS - (now - window[0])))
            return error_response(
                429,
                "RATE_LIMITED",
                "Too many requests",
                trace_id=getattr(g, "trace_id", None),
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)
        return handler(*args, **kwargs)

    wrapper._scope_rate_limited = True
    return wrapper  # type: ignore[return-value]
