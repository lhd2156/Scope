from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from collections.abc import Callable
from functools import wraps
from hashlib import sha256
from threading import Lock
from typing import Any, ParamSpec, overload

import jwt
from flask import current_app, g, request

from app.auth import extract_bearer_token
from app.client_ip import get_client_ip
from app.responses import error_response

RouteParams = ParamSpec("RouteParams")
WINDOW_SECONDS = 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)
_fallback_lock = Lock()
_redis_lock = Lock()
_redis_clients: dict[str, Any] = {}
_redis_retry_after: dict[str, float] = {}

_FIXED_WINDOW_SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""


def reset_rate_limit_state() -> None:
    with _fallback_lock:
        _request_windows.clear()
    with _redis_lock:
        _redis_clients.clear()
        _redis_retry_after.clear()


def _client_key(limit_bucket: str) -> str:
    identity = _verified_identity()
    route_bucket = request.endpoint or request.path
    digest = sha256(identity.encode("utf-8")).hexdigest()[:32]
    return f"scope:intel:rl:{limit_bucket}:{route_bucket}:{digest}"


def _verified_identity() -> str:
    token = extract_bearer_token(request.headers.get("Authorization"))
    if token:
        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET"],
                algorithms=["HS256"],
                audience=current_app.config["JWT_AUDIENCE"],
                issuer=current_app.config["JWT_ISSUER"],
            )
            subject = str(payload.get("sub") or "").strip()
            if subject:
                return f"user:{subject}"
        except jwt.PyJWTError:
            pass

    return f"ip:{get_client_ip()}"


def _redis_client():
    storage_uri = str(current_app.config.get("RATELIMIT_STORAGE_URI") or "").strip()
    if not storage_uri.startswith(("redis://", "rediss://", "unix://")):
        return None

    now = time.monotonic()
    with _redis_lock:
        if _redis_retry_after.get(storage_uri, 0.0) > now:
            return None
        client = _redis_clients.get(storage_uri)
        if client is not None:
            return client

        try:
            import redis

            client = redis.from_url(
                storage_uri,
                socket_connect_timeout=1,
                socket_timeout=2,
                health_check_interval=30,
            )
        except Exception:
            _redis_retry_after[storage_uri] = now + 5
            current_app.logger.warning("Intel Redis rate limiter initialization failed", exc_info=True)
            return None

        _redis_clients[storage_uri] = client
        return client


def _permit_redis(key: str, limit: int) -> tuple[bool, int] | None:
    client = _redis_client()
    if client is None:
        return None

    try:
        current, ttl = client.eval(
            _FIXED_WINDOW_SCRIPT,
            1,
            key,
            WINDOW_SECONDS,
        )
        return int(current) <= limit, max(1, int(ttl or WINDOW_SECONDS))
    except Exception:
        storage_uri = str(current_app.config.get("RATELIMIT_STORAGE_URI") or "").strip()
        with _redis_lock:
            _redis_retry_after[storage_uri] = time.monotonic() + 5
        current_app.logger.warning("Intel Redis rate limit operation failed", exc_info=True)
        return None


def _permit_local(key: str, limit: int) -> tuple[bool, int]:
    now = time.time()
    with _fallback_lock:
        window = _request_windows[key]

        while window and now - window[0] >= WINDOW_SECONDS:
            window.popleft()

        if len(window) >= limit:
            return False, max(1, math.ceil(WINDOW_SECONDS - (now - window[0])))

        window.append(now)
        return True, WINDOW_SECONDS


def _decorate_rate_limited(handler: Callable[RouteParams, Any], *, limit_config_key: str) -> Callable[RouteParams, Any]:
    @wraps(handler)
    def wrapper(*args: RouteParams.args, **kwargs: RouteParams.kwargs) -> Any:
        if not current_app.config.get("RATELIMIT_ENABLED", True):
            return handler(*args, **kwargs)

        configured_limit = current_app.config.get(limit_config_key)
        if configured_limit is None:
            configured_limit = current_app.config.get("RATE_LIMIT_PER_MINUTE", 60)
        limit = int(configured_limit)
        if limit <= 0:
            return handler(*args, **kwargs)

        key = _client_key(limit_config_key)
        permitted = _permit_redis(key, limit)
        if permitted is None:
            permitted = _permit_local(key, limit)

        allowed, retry_after = permitted
        if not allowed:
            return error_response(
                429,
                "RATE_LIMITED",
                "Too many requests",
                trace_id=getattr(g, "trace_id", None),
                headers={"Retry-After": str(retry_after)},
            )

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
