"""Tests for the Redis sliding-window rate limiter."""

from __future__ import annotations

from unittest.mock import MagicMock

from django.conf import settings
from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from common.middleware.ratelimit import RateLimitMiddleware


class TestRateLimitMiddleware:
    def test_allows_requests_under_limit(self):
        factory = RequestFactory()
        request = factory.get("/api/content/spots/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 5, None, None]
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 200
        assert response["X-RateLimit-Limit"] == str(settings.RATE_LIMIT_GLOBAL_PER_IP)
        assert response["X-RateLimit-Remaining"] == str(settings.RATE_LIMIT_GLOBAL_PER_IP - 6)

    def test_blocks_requests_over_limit(self):
        factory = RequestFactory()
        request = factory.get("/api/content/spots/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, settings.RATE_LIMIT_GLOBAL_PER_IP, None, None]
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 429
        assert response["Retry-After"] == "60"

    @override_settings(RATE_LIMIT_AUTH_PER_IP=10)
    def test_auth_endpoints_have_stricter_limit(self):
        factory = RequestFactory()
        request = factory.post("/api/content/auth/login")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 10, None, None]
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 429

    @override_settings(RATE_LIMIT_SEARCH_PER_IP=30)
    def test_search_endpoints_have_search_limit(self):
        factory = RequestFactory()
        request = factory.get("/api/content/search?q=coffee")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 29, None, None]
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 200
        assert response["X-RateLimit-Limit"] == "30"

    @override_settings(RATE_LIMIT_COMMENTS_PER_USER=1)
    def test_comment_mutations_have_comment_limit(self):
        factory = RequestFactory()
        request = factory.post("/api/content/comments/", {"body": "Nice stop"})
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.side_effect = [
            [None, 0, None, None],
            [None, 1, None, None],
        ]
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 429
        assert response["Retry-After"] == "60"
