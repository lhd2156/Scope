from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from common.middleware import rate_limit
from common.middleware.rate_limit import RateLimitMiddleware

pytestmark = pytest.mark.django_db


def test_non_content_paths_bypass_rate_limit():
    request = RequestFactory().get("/assets/app.js")
    response = RateLimitMiddleware(lambda req: HttpResponse("ok"))(request)
    assert response.status_code == 200
    assert response.content == b"ok"


@override_settings(RATE_LIMIT_GLOBAL_PER_IP=100, RATE_LIMIT_UPLOAD_PER_USER=7, RATE_LIMIT_COMMENTS_PER_USER=3)
def test_limits_for_request_include_global_upload_and_comment_buckets():
    middleware = RateLimitMiddleware(lambda req: HttpResponse("ok"))
    factory = RequestFactory()

    upload = factory.post("/api/content/photos/upload")
    upload.META["HTTP_X_FORWARDED_FOR"] = "203.0.113.7, 10.0.0.1"
    upload.user = SimpleNamespace(id="user-1")
    assert middleware._limits_for_request(upload) == [("global:203.0.113.7", 100), ("upload:user-1", 7)]

    comment = factory.delete("/api/content/comments/abc")
    comment.META["REMOTE_ADDR"] = "198.51.100.8"
    comment.user = SimpleNamespace(id=None)
    assert middleware._limits_for_request(comment) == [("global:198.51.100.8", 100), ("comments:198.51.100.8", 3)]


@override_settings(RATE_LIMIT_WINDOW_SECONDS=60, RATE_LIMIT_GLOBAL_PER_IP=1)
def test_cache_counter_allows_then_blocks(monkeypatch):
    middleware = RateLimitMiddleware(lambda req: HttpResponse("ok"))
    request = RequestFactory().get("/api/content/spots/")
    request.META["REMOTE_ADDR"] = "127.0.0.1"
    calls = []

    class FakeCache:
        def add(self, key, value, timeout):
            calls.append(("add", key, value, timeout))
            return len(calls) == 1

        def incr(self, key):
            calls.append(("incr", key))
            return 2

    monkeypatch.setattr(rate_limit, "cache", FakeCache())

    assert middleware._enforce_limit(request, "global:127.0.0.1", 1) is None
    blocked = middleware._enforce_limit(request, "global:127.0.0.1", 1)

    assert blocked.status_code == 429
    assert blocked["Retry-After"] == "60"


@override_settings(RATE_LIMIT_WINDOW_SECONDS=60)
def test_cache_failure_degrades_to_fallback_and_fallback_expires(monkeypatch):
    middleware = RateLimitMiddleware(lambda req: HttpResponse("ok"))
    request = RequestFactory().get("/api/content/health")
    request.META["REMOTE_ADDR"] = "127.0.0.1"

    class BrokenCache:
        def add(self, *args, **kwargs):
            raise RuntimeError("redis offline")

    monkeypatch.setattr(rate_limit, "cache", BrokenCache())
    monkeypatch.setattr(rate_limit, "time", lambda: 1000.0)

    assert middleware._enforce_limit(request, "global:127.0.0.1", 1) is None
    blocked = middleware._enforce_limit(request, "global:127.0.0.1", 1)
    assert blocked.status_code == 429
    assert blocked.json if hasattr(blocked, "json") else blocked.content

    monkeypatch.setattr(rate_limit, "time", lambda: 1061.0)
    assert middleware._enforce_limit_fallback(request, "global:127.0.0.1", 1, 60) is None


def test_build_limited_response_includes_trace_id():
    request = RequestFactory().post("/api/content/comments/")
    request.correlation_id = "trace-1"

    response = RateLimitMiddleware._build_limited_response(request, 12)

    assert response.status_code == 429
    assert response["Retry-After"] == "12"
    assert b"trace-1" in response.content
