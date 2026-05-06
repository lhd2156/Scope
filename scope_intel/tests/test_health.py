from app.api import health as health_module


def test_health_endpoint_reports_healthy_when_dependencies_are_ready(client, monkeypatch):
    monkeypatch.setattr(health_module.service, "database_ready", lambda: True)
    monkeypatch.setattr(health_module.service, "ml_model_ready", lambda: True)

    response = client.get("/api/intel/health")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "healthy"
    assert payload["version"] == "1.0.0"
    assert isinstance(payload["uptime"], int)


def test_health_endpoint_reports_unhealthy_when_database_check_fails(client, monkeypatch):
    monkeypatch.setattr(health_module.service, "database_ready", lambda: False)
    monkeypatch.setattr(health_module.service, "ml_model_ready", lambda: True)

    response = client.get("/api/intel/health")

    assert response.status_code == 503
    payload = response.get_json()
    assert set(payload.keys()) == {"status", "version", "uptime"}
    assert payload["status"] == "unhealthy"


def test_health_endpoint_reports_unhealthy_when_ml_check_fails(client, monkeypatch):
    monkeypatch.setattr(health_module.service, "database_ready", lambda: True)
    monkeypatch.setattr(health_module.service, "ml_model_ready", lambda: False)

    response = client.get("/api/intel/health")

    assert response.status_code == 503
    payload = response.get_json()
    assert set(payload.keys()) == {"status", "version", "uptime"}
    assert payload["status"] == "unhealthy"
