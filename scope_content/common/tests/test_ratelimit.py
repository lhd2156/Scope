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
        mock_redis.eval.return_value = [1, 6, 0]

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
        mock_redis.eval.return_value = [0, settings.RATE_LIMIT_GLOBAL_PER_IP, 17]

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 429
        assert response["Retry-After"] == "17"
        assert mock_redis.eval.call_args.args[1:3] == (1, "rl:global:127.0.0.1")

    @override_settings(RATE_LIMIT_AUTH_PER_IP=10)
    def test_auth_endpoints_have_stricter_limit(self):
        factory = RequestFactory()
        request = factory.post("/api/content/auth/login")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_redis.eval.side_effect = [
            [1, 1, 0],
            [0, 10, 12],
        ]

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
        mock_redis.eval.side_effect = [
            [1, 1, 0],
            [1, 30, 0],
        ]

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
        mock_redis.eval.side_effect = [
            [1, 1, 0],
            [0, 1, 8],
        ]

        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))
        middleware._redis = mock_redis

        response = middleware(request)

        assert response.status_code == 429
        assert response["Retry-After"] == "8"

    @override_settings(TRUSTED_PROXY_CIDRS=["10.0.0.0/8"])
    def test_forwarded_for_is_trusted_only_from_configured_proxy(self):
        factory = RequestFactory()
        middleware = RateLimitMiddleware(lambda r: HttpResponse(status=200))

        untrusted = factory.get("/api/content/spots/", REMOTE_ADDR="198.51.100.5", HTTP_X_FORWARDED_FOR="203.0.113.7")
        trusted = factory.get("/api/content/spots/", REMOTE_ADDR="10.0.0.8", HTTP_X_FORWARDED_FOR="203.0.113.7, 10.0.0.8")
        invalid = factory.get("/api/content/spots/", REMOTE_ADDR="10.0.0.8", HTTP_X_FORWARDED_FOR="not-an-ip")

        assert middleware._get_client_ip(untrusted) == "198.51.100.5"
        assert middleware._get_client_ip(trusted) == "203.0.113.7"
        assert middleware._get_client_ip(invalid) == "10.0.0.8"
