from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def test_metrics_endpoint_exposes_prometheus_payload(api_client, monkeypatch):
    monkeypatch.setattr('common.views.connection.ensure_connection', lambda: None)
    monkeypatch.setattr('common.views.S3StorageService.health_status', lambda self: 'local')

    health_response = api_client.get('/api/content/health')
    metrics_response = api_client.get('/metrics')
    payload = metrics_response.content.decode('utf-8')

    assert health_response.status_code == 200
    assert metrics_response.status_code == 200
    assert metrics_response['Content-Type'].startswith('text/plain')
    assert 'atlas_content_http_requests_total' in payload
    assert 'route="/api/content/health"' in payload
    assert 'atlas_content_service_health{service="content"} 1.0' in payload
