from app.api import health as health_module


def test_metrics_endpoint_exposes_prometheus_payload(client, monkeypatch):
    monkeypatch.setattr(health_module.service, "database_ready", lambda: True)
    monkeypatch.setattr(health_module.service, "ml_model_ready", lambda: True)

    health_response = client.get("/api/intel/health")
    metrics_response = client.get("/metrics")
    payload = metrics_response.get_data(as_text=True)

    assert health_response.status_code == 200
    assert metrics_response.status_code == 200
    assert metrics_response.content_type.startswith("text/plain")
    assert "atlas_intel_http_requests_total" in payload
    assert 'route="/api/intel/health"' in payload
    assert 'atlas_intel_service_health{service="intel"} 1.0' in payload
