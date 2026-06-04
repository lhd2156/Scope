from types import SimpleNamespace

import jwt
import pytest
from fastapi import HTTPException
from fastapi.responses import Response

from app import security


TEST_SECRET = "scope-rag-test-secret"


class RequestStub:
    def __init__(self, path="/api/rag/ask", method="POST", headers=None, client_host="10.0.0.7"):
        self.url = SimpleNamespace(path=path)
        self.method = method
        self.headers = headers or {}
        self.client = SimpleNamespace(host=client_host) if client_host is not None else None


def setup_function():
    security._redis_client = None
    security._redis_unavailable = False
    security.reset_rate_limit_state()
    security.settings.core_jwt_secret = TEST_SECRET
    security.settings.rag_rate_limit_redis_url = ""
    security.settings.rag_rate_limit_enabled = True
    security.settings.rag_rate_limit_per_minute = 60
    security.settings.rag_generation_rate_limit_per_minute = 10
    security.settings.rag_ingest_rate_limit_per_minute = 5


@pytest.mark.asyncio
async def test_require_auth_rejects_missing_malformed_unconfigured_and_invalid_tokens():
    with pytest.raises(HTTPException) as missing:
        await security.require_auth(None)
    assert missing.value.status_code == 401
    assert missing.value.headers == {"WWW-Authenticate": "Bearer"}

    with pytest.raises(HTTPException) as malformed:
        await security.require_auth("Basic abc")
    assert malformed.value.status_code == 401

    security.settings.core_jwt_secret = ""
    with pytest.raises(HTTPException) as unconfigured:
        await security.require_auth("Bearer abc")
    assert unconfigured.value.status_code == 503

    security.settings.core_jwt_secret = TEST_SECRET
    with pytest.raises(HTTPException) as invalid:
        await security.require_auth("Bearer not-a-token")
    assert invalid.value.status_code == 401


@pytest.mark.asyncio
async def test_require_auth_returns_valid_claims():
    token = jwt.encode(
        {"sub": "user-1", "iss": security.settings.core_jwt_issuer, "aud": security.settings.core_jwt_audience},
        TEST_SECRET,
        algorithm="HS256",
    )

    claims = await security.require_auth(f"Bearer {token}")

    assert claims["sub"] == "user-1"


@pytest.mark.asyncio
async def test_rate_limit_middleware_bypasses_disabled_and_non_rag_paths():
    calls = []

    async def call_next(request):
        calls.append(request.url.path)
        return Response("ok")

    security.settings.rag_rate_limit_enabled = False
    assert (await security.rate_limit_middleware(RequestStub(), call_next)).body == b"ok"

    security.settings.rag_rate_limit_enabled = True
    assert (await security.rate_limit_middleware(RequestStub(path="/health"), call_next)).body == b"ok"
    assert calls == ["/api/rag/ask", "/health"]


@pytest.mark.asyncio
async def test_rate_limit_middleware_sets_limit_header_and_ignores_spoofed_forwarded_ip(monkeypatch):
    captured = {}

    async def fake_permit(key, limit):
        captured["key"] = key
        captured["limit"] = limit
        return True, 60

    async def call_next(request):
        return Response("ok")

    monkeypatch.setattr(security, "_permit", fake_permit)

    response = await security.rate_limit_middleware(
        RequestStub(headers={"x-forwarded-for": "203.0.113.9, 10.0.0.1"}),
        call_next,
    )

    assert captured == {"key": "generation:10.0.0.7", "limit": 10}
    assert response.headers["X-RateLimit-Limit"] == "10"


@pytest.mark.asyncio
async def test_rate_limit_middleware_blocks_when_limit_exceeded(monkeypatch):
    async def fake_permit(key, limit):
        return False, 17

    monkeypatch.setattr(security, "_permit", fake_permit)

    response = await security.rate_limit_middleware(RequestStub(path="/api/rag/ingest"), lambda request: Response("nope"))

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "17"
    assert response.body


def test_limit_for_path_and_request_key_cover_bucket_variants():
    assert security._limit_for_path("/api/rag/ask", "POST").bucket == "generation"
    assert security._limit_for_path("/api/rag/scope-ai", "post").bucket == "generation"
    assert security._limit_for_path("/api/rag/ingest", "POST").bucket == "ingest"
    assert security._limit_for_path("/api/rag/search", "GET").bucket == "global"
    assert security._request_key(RequestStub(headers={}, client_host=None), "global") == "global:unknown"


@pytest.mark.asyncio
async def test_permit_uses_redis_allows_denies_and_falls_back(monkeypatch):
    class FakeRedis:
        def __init__(self, counts, ttl=9):
            self.counts = iter(counts)
            self.expired = []
            self.ttl_value = ttl

        async def incr(self, key):
            return next(self.counts)

        async def expire(self, key, seconds):
            self.expired.append((key, seconds))

        async def ttl(self, key):
            return self.ttl_value

    security.settings.rag_rate_limit_redis_url = "redis://example/0"
    security._redis_client = FakeRedis([1])
    assert await security._permit("generation:ip", 2) == (True, security.WINDOW_SECONDS)
    assert security._redis_client.expired == [("scope:rag:rl:generation:ip", security.WINDOW_SECONDS)]

    security._redis_client = FakeRedis([3], ttl=7)
    assert await security._permit("generation:ip", 2) == (False, 7)

    class BrokenRedis:
        async def incr(self, key):
            raise RuntimeError("redis offline")

    async def fake_local(key, limit):
        return True, 44

    security._redis_client = BrokenRedis()
    monkeypatch.setattr(security, "_permit_local", fake_local)

    assert await security._permit("generation:ip", 2) == (True, 44)


@pytest.mark.asyncio
async def test_get_redis_returns_none_when_disabled_or_marked_unavailable():
    security.settings.rag_rate_limit_redis_url = ""
    assert await security._get_redis() is None

    security.settings.rag_rate_limit_redis_url = "redis://example/0"
    security._redis_unavailable = True
    assert await security._get_redis() is None


@pytest.mark.asyncio
async def test_local_rate_limiter_tracks_limit_and_expires(monkeypatch):
    monkeypatch.setattr(security.time, "time", lambda: 1000.0)

    assert await security._permit_local("global:ip", 1) == (True, security.WINDOW_SECONDS)
    assert await security._permit_local("global:ip", 1) == (False, security.WINDOW_SECONDS)

    monkeypatch.setattr(security.time, "time", lambda: 1000.0 + security.WINDOW_SECONDS + 1)

    assert await security._permit_local("global:ip", 1) == (True, security.WINDOW_SECONDS)
