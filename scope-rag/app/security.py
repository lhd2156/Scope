"""Authentication and rate-limit helpers for the RAG service."""

from __future__ import annotations

import asyncio
import math
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from hashlib import sha256
from ipaddress import ip_address, ip_network
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response

from app.config import settings

WINDOW_SECONDS = 60
ROLE_CLAIM_KEYS = (
    "role",
    "roles",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
)
_FALLBACK_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_FALLBACK_LOCK = asyncio.Lock()
_redis_client: Any | None = None
_redis_unavailable = False


def reset_rate_limit_state() -> None:
    """Reset local limiter state for tests."""

    _FALLBACK_BUCKETS.clear()


async def require_auth(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization:
        raise _unauthorized()

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized()

    if not settings.core_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AUTH_NOT_CONFIGURED", "message": "RAG authentication is not configured"}},
        )

    try:
        return jwt.decode(
            token.strip(),
            settings.core_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.core_jwt_issuer,
            audience=settings.core_jwt_audience,
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized() from exc


async def require_ingest_admin(claims: dict[str, Any] = Depends(require_auth)) -> dict[str, Any]:
    required_role = settings.rag_ingest_required_role.strip().lower()
    if not required_role:
        return claims

    if _claims_include_role(claims, required_role):
        return claims

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": {"code": "FORBIDDEN", "message": "Admin role required for RAG ingest"}},
    )


async def rate_limit_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    if not settings.rag_rate_limit_enabled or not request.url.path.startswith("/api/rag"):
        return await call_next(request)

    limit = _limit_for_path(request.url.path, request.method)
    key = _request_key(request, limit.bucket)
    allowed, retry_after = await _permit(key, limit.permit_limit)

    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"error": {"code": "RATE_LIMITED", "message": "Too many requests", "details": [], "traceId": None}},
            headers={"Retry-After": str(retry_after)},
        )

    response = await call_next(request)
    response.headers.setdefault("X-RateLimit-Limit", str(limit.permit_limit))
    return response


class _Limit:
    def __init__(self, bucket: str, permit_limit: int):
        self.bucket = bucket
        self.permit_limit = max(1, permit_limit)


def _limit_for_path(path: str, method: str) -> _Limit:
    if method.upper() == "POST" and path in {"/api/rag/ask", "/api/rag/scope-ai"}:
        return _Limit("generation", settings.rag_generation_rate_limit_per_minute)
    if method.upper() == "POST" and path == "/api/rag/ingest":
        return _Limit("ingest", settings.rag_ingest_rate_limit_per_minute)
    return _Limit("global", settings.rag_rate_limit_per_minute)


def _claims_include_role(claims: dict[str, Any], required_role: str) -> bool:
    for key in ROLE_CLAIM_KEYS:
        if _role_value_matches(claims.get(key), required_role):
            return True
    return False


def _role_value_matches(value: Any, required_role: str) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        roles = [part.strip().lower() for part in value.replace(",", " ").split()]
        return required_role in roles
    if isinstance(value, (list, tuple, set)):
        return any(_role_value_matches(entry, required_role) for entry in value)
    return False


def _request_key(request: Request, bucket: str) -> str:
    identity = _verified_request_identity(request) or f"ip:{_client_ip(request)}"
    identity_kind = identity.partition(":")[0]
    identity_digest = sha256(identity.encode("utf-8")).hexdigest()[:32]
    return f"{bucket}:{identity_kind}:{identity_digest}"


def _verified_request_identity(request: Request) -> str | None:
    authorization = request.headers.get("authorization") or request.headers.get("Authorization")
    if not authorization or not settings.core_jwt_secret:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None

    try:
        claims = jwt.decode(
            token.strip(),
            settings.core_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.core_jwt_issuer,
            audience=settings.core_jwt_audience,
        )
    except jwt.PyJWTError:
        return None

    subject = str(claims.get("sub") or "").strip()
    return f"user:{subject}" if subject else None


def _client_ip(request: Request) -> str:
    remote_addr = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if not forwarded_for or not _remote_addr_is_trusted_proxy(remote_addr):
        return remote_addr

    candidate = forwarded_for.split(",", 1)[0].strip()
    try:
        ip_address(candidate)
    except ValueError:
        return remote_addr
    return candidate


def _remote_addr_is_trusted_proxy(remote_addr: str) -> bool:
    try:
        remote_ip = ip_address(remote_addr)
    except ValueError:
        return False

    raw_value = settings.rag_trusted_proxy_cidrs
    entries = raw_value.replace(";", ",").split(",") if isinstance(raw_value, str) else raw_value
    for entry in entries:
        value = str(entry).strip()
        if not value:
            continue
        try:
            if remote_ip in ip_network(value, strict=False):
                return True
        except ValueError:
            continue
    return False


async def _permit(key: str, limit: int) -> tuple[bool, int]:
    client = await _get_redis()
    if client is not None:
        cache_key = f"scope:rag:rl:{key}"
        try:
            count = await client.incr(cache_key)
            if count == 1:
                await client.expire(cache_key, WINDOW_SECONDS)
            if count <= limit:
                return True, WINDOW_SECONDS
            ttl = await client.ttl(cache_key)
            return False, max(1, int(ttl if ttl and ttl > 0 else WINDOW_SECONDS))
        except Exception:
            pass

    return await _permit_local(key, limit)


async def _get_redis():
    global _redis_client, _redis_unavailable

    if _redis_unavailable or not settings.rag_rate_limit_redis_url:
        return None
    if _redis_client is not None:
        return _redis_client

    try:
        import redis.asyncio as redis

        _redis_client = redis.from_url(
            settings.rag_rate_limit_redis_url,
            socket_connect_timeout=1,
            socket_timeout=2,
            health_check_interval=30,
        )
        return _redis_client
    except Exception:
        _redis_unavailable = True
        return None


async def _permit_local(key: str, limit: int) -> tuple[bool, int]:
    now = time.time()
    async with _FALLBACK_LOCK:
        bucket = _FALLBACK_BUCKETS[key]
        while bucket and now - bucket[0] >= WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, math.ceil(WINDOW_SECONDS - (now - bucket[0])))
            return False, retry_after
        bucket.append(now)
        return True, WINDOW_SECONDS


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": "UNAUTHORIZED", "message": "Authentication required"}},
        headers={"WWW-Authenticate": "Bearer"},
    )
