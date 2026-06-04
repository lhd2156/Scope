from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec, overload

from flask import current_app, g, request

from app.responses import error_response

RouteParams = ParamSpec("RouteParams")
WINDOW_SECONDS = 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_limit_state() -> None:
    _request_windows.clear()


def _client_key(limit_bucket: str) -> str:
    identity = request.headers.get("Authorization") or request.remote_addr or "anonymous"
    route_bucket = request.endpoint or request.path
    return f"{limit_bucket}:{route_bucket}:{identity}"


def _decorate_rate_limited(handler: Callable[RouteParams, Any], *, limit_config_key: str) -> Callable[RouteParams, Any]:
    @wraps(handler)
    def wrapper(*args: RouteParams.args, **kwargs: RouteParams.kwargs) -> Any:
        if not current_app.config.get("RATELIMIT_ENABLED", True):
            return handler(*args, **kwargs)

        limit = int(
            current_app.config.get(limit_config_key)
            or current_app.config.get("RATE_LIMIT_PER_MINUTE")
            or 60
        )
        if limit <= 0:
            return handler(*args, **kwargs)

        now = time.time()
        window = _request_windows[_client_key(limit_config_key)]

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
    return wrapper


@overload
def rate_limited(
    handler: Callable[RouteParams, Any],
    *,
    limit_config_key: str = "RATE_LIMIT_PER_MINUTE",
) -> Callable[RouteParams, Any]:
    ...


@overload
def rate_limited(
    handler: None = None,
    *,
    limit_config_key: str = "RATE_LIMIT_PER_MINUTE",
) -> Callable[[Callable[RouteParams, Any]], Callable[RouteParams, Any]]:
    ...


def rate_limited(
    handler: Callable[RouteParams, Any] | None = None,
    *,
    limit_config_key: str = "RATE_LIMIT_PER_MINUTE",
) -> Callable[RouteParams, Any] | Callable[[Callable[RouteParams, Any]], Callable[RouteParams, Any]]:
    def decorator(route_handler: Callable[RouteParams, Any]) -> Callable[RouteParams, Any]:
        return _decorate_rate_limited(route_handler, limit_config_key=limit_config_key)

    if handler is None:
        return decorator

    return decorator(handler)
