from types import SimpleNamespace
from hashlib import sha256

import jwt
import pytest
import redis.asyncio as redis_asyncio
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
    security._redis_unavailable_until = 0.0
    security.reset_rate_limit_state()
    security.settings.core_jwt_secret = TEST_SECRET
    security.settings.rag_rate_limit_redis_url = ""
    security.settings.rag_rate_limit_enabled = True
    security.settings.rag_rate_limit_per_minute = 60
    security.settings.rag_generation_rate_limit_per_minute = 10
    security.settings.rag_ingest_rate_limit_per_minute = 5
    security.settings.rag_trusted_proxy_cidrs = "10.0.0.0/8,172.16.0.0/12"


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
async def test_require_ingest_admin_supports_disabled_and_list_role_policies():
    security.settings.rag_ingest_required_role = ""
    claims = {"sub": "user-1"}
    assert await security.require_ingest_admin(claims) is claims

    security.settings.rag_ingest_required_role = "admin"
    admin_claims = {"roles": ["viewer", "ADMIN"]}
    assert await security.require_ingest_admin(admin_claims) is admin_claims

    with pytest.raises(HTTPException) as forbidden:
        await security.require_ingest_admin({"roles": ["viewer", 7]})
    assert forbidden.value.status_code == 403


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
        RequestStub(
            headers={"x-forwarded-for": "203.0.113.9, 10.0.0.1"},
            client_host="198.51.100.7",
        ),
        call_next,
    )

    expected_digest = sha256(b"ip:198.51.100.7").hexdigest()[:32]
    assert captured == {"key": f"generation:ip:{expected_digest}", "limit": 10}
    assert response.headers["X-RateLimit-Limit"] == "10"


@pytest.mark.asyncio
async def test_rate_limit_middleware_uses_trusted_proxy_ip_and_verified_user_identity(monkeypatch):
    captured = []

    async def fake_permit(key, limit):
        captured.append((key, limit))
        return True, 60

    async def call_next(request):
        return Response("ok")

    monkeypatch.setattr(security, "_permit", fake_permit)

    await security.rate_limit_middleware(
        RequestStub(
            headers={"x-forwarded-for": "203.0.113.9, 172.20.0.2"},
            client_host="172.20.0.3",
        ),
        call_next,
    )
    trusted_proxy_digest = sha256(b"ip:203.0.113.9").hexdigest()[:32]
    assert captured[-1] == (f"generation:ip:{trusted_proxy_digest}", 10)

    token = jwt.encode(
        {"sub": "user-42", "iss": security.settings.core_jwt_issuer, "aud": security.settings.core_jwt_audience},
        TEST_SECRET,
        algorithm="HS256",
    )
    await security.rate_limit_middleware(
        RequestStub(
            headers={
                "authorization": f"Bearer {token}",
                "x-forwarded-for": "203.0.113.10",
            },
            client_host="172.20.0.3",
        ),
        call_next,
    )
    user_digest = sha256(b"user:user-42").hexdigest()[:32]
    assert captured[-1] == (f"generation:user:{user_digest}", 10)


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
    unknown_digest = sha256(b"ip:unknown").hexdigest()[:32]
    assert security._request_key(RequestStub(headers={}, client_host=None), "global") == f"global:ip:{unknown_digest}"


def test_client_ip_rejects_invalid_forwarded_values_and_invalid_proxy_config():
    security.settings.rag_trusted_proxy_cidrs = "not-a-cidr,172.16.0.0/12"
    request = RequestStub(
        headers={"x-forwarded-for": "not-an-ip, 203.0.113.9"},
        client_host="172.20.0.3",
    )

    assert security._client_ip(request) == "172.20.0.3"
    assert security._remote_addr_is_trusted_proxy("not-an-ip") is False


def test_request_identity_rejects_malformed_invalid_and_subjectless_tokens():
    assert security._verified_request_identity(RequestStub(headers={"authorization": "Basic abc"})) is None
    assert security._verified_request_identity(RequestStub(headers={"authorization": "Bearer invalid"})) is None

    subjectless_token = jwt.encode(
        {"iss": security.settings.core_jwt_issuer, "aud": security.settings.core_jwt_audience},
        TEST_SECRET,
        algorithm="HS256",
    )
    assert security._verified_request_identity(
        RequestStub(headers={"authorization": f"Bearer {subjectless_token}"})
    ) is None

    security.settings.rag_trusted_proxy_cidrs = ["", "172.16.0.0/12"]
    assert security._remote_addr_is_trusted_proxy("172.20.0.3") is True


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
    assert security._redis_client is None
    assert security._redis_unavailable is True


@pytest.mark.asyncio
async def test_get_redis_returns_none_when_disabled_or_marked_unavailable():
    security.settings.rag_rate_limit_redis_url = ""
    assert await security._get_redis() is None

    security.settings.rag_rate_limit_redis_url = "redis://example/0"
    security._redis_unavailable = True
    security._redis_unavailable_until = security.time.time() + 30
    assert await security._get_redis() is None


@pytest.mark.asyncio
async def test_get_redis_initializes_client_and_marks_factory_failures(monkeypatch):
    security.settings.rag_rate_limit_redis_url = "redis://example/0"
    client = await security._get_redis()
    assert client is security._redis_client
    await client.aclose()

    security._redis_client = None
    monkeypatch.setattr(redis_asyncio, "from_url", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("bad url")))

    assert await security._get_redis() is None
    assert security._redis_unavailable is True
    assert security._redis_unavailable_until > 0


@pytest.mark.asyncio
async def test_get_redis_retries_after_factory_failure_cooldown(monkeypatch):
    now = {"value": 1000.0}

    class FakeRedisClient:
        pass

    def fake_from_url(*args, **kwargs):
        if now["value"] < 1030.0:
            raise RuntimeError("bad url")
        return FakeRedisClient()

    monkeypatch.setattr(security.time, "time", lambda: now["value"])
    monkeypatch.setattr(redis_asyncio, "from_url", fake_from_url)
    security.settings.rag_rate_limit_redis_url = "redis://example/0"

    assert await security._get_redis() is None
    assert security._redis_unavailable is True
    now["value"] += security.REDIS_RETRY_SECONDS + 1

    client = await security._get_redis()
    assert isinstance(client, FakeRedisClient)
    assert security._redis_unavailable is False


@pytest.mark.asyncio
async def test_local_rate_limiter_tracks_limit_and_expires(monkeypatch):
    monkeypatch.setattr(security.time, "time", lambda: 1000.0)

    assert await security._permit_local("global:ip", 1) == (True, security.WINDOW_SECONDS)
    assert await security._permit_local("global:ip", 1) == (False, security.WINDOW_SECONDS)

    monkeypatch.setattr(security.time, "time", lambda: 1000.0 + security.WINDOW_SECONDS + 1)

    assert await security._permit_local("global:ip", 1) == (True, security.WINDOW_SECONDS)
