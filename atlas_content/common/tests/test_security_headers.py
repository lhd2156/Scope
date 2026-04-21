from __future__ import annotations

import pytest
from django.test import override_settings

from common.middleware.rate_limit import _BUCKETS

DEFAULT_CSP = (
    "default-src 'self'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'; "
    "object-src 'none'; "
    "form-action 'self'; "
    "connect-src 'self' https://atlas-frontend.example; "
    "img-src 'self' data: blob: https:; "
    "font-src 'self' data: https:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "script-src 'self' 'unsafe-inline'"
)


@pytest.fixture(autouse=True)
def clear_rate_limit_buckets():
    _BUCKETS.clear()
    yield
    _BUCKETS.clear()


@pytest.mark.django_db
@override_settings(CONTENT_SECURITY_POLICY=DEFAULT_CSP)
def test_csp_header_is_present_on_success_response(api_client):
    response = api_client.get('/api/content/health')

    assert response.status_code == 200
    assert response['Content-Security-Policy'] == DEFAULT_CSP


@pytest.mark.django_db
@override_settings(CONTENT_SECURITY_POLICY=DEFAULT_CSP)
def test_csp_header_is_present_on_unauthorized_response(api_client):
    response = api_client.get('/api/content/trips/')

    assert response.status_code == 401
    assert response['Content-Security-Policy'] == DEFAULT_CSP


@pytest.mark.django_db
@override_settings(
    CONTENT_SECURITY_POLICY=DEFAULT_CSP,
    RATE_LIMIT_WINDOW_SECONDS=60,
    RATE_LIMIT_GLOBAL_PER_IP=2,
    RATE_LIMIT_UPLOAD_PER_USER=20,
)
def test_csp_header_is_present_on_rate_limited_response(api_client):
    remote_addr = '203.0.113.20'

    first_response = api_client.get('/api/content/health', REMOTE_ADDR=remote_addr)
    second_response = api_client.get('/api/content/spots/', REMOTE_ADDR=remote_addr)
    third_response = api_client.get('/api/content/health', REMOTE_ADDR=remote_addr)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert third_response.status_code == 429
    assert third_response['Content-Security-Policy'] == DEFAULT_CSP
