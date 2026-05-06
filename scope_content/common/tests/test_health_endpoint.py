from __future__ import annotations

import pytest
from django.db.utils import OperationalError

pytestmark = pytest.mark.django_db


def test_health_endpoint_checks_database_and_storage(api_client, monkeypatch):
    calls: list[str] = []

    def fake_ensure_connection():
        calls.append('db')

    def fake_health_status(self):
        calls.append('storage')
        return 'local'

    monkeypatch.setattr('common.views.connection.ensure_connection', fake_ensure_connection)
    monkeypatch.setattr('common.views.S3StorageService.health_status', fake_health_status)

    response = api_client.get('/api/content/health')

    assert response.status_code == 200
    assert response.json()['status'] == 'healthy'
    assert set(response.json().keys()) == {'status', 'version', 'uptime'}
    assert calls == ['db', 'storage']



def test_health_endpoint_returns_unhealthy_when_database_check_fails(api_client, monkeypatch):
    def fake_ensure_connection():
        raise OperationalError('db down')

    monkeypatch.setattr('common.views.connection.ensure_connection', fake_ensure_connection)

    response = api_client.get('/api/content/health')

    assert response.status_code == 503
    assert response.json()['status'] == 'unhealthy'
    assert set(response.json().keys()) == {'status', 'version', 'uptime'}



def test_health_endpoint_returns_unhealthy_when_storage_check_fails(api_client, monkeypatch):
    def fake_health_status(self):
        raise RuntimeError('storage down')

    monkeypatch.setattr('common.views.connection.ensure_connection', lambda: None)
    monkeypatch.setattr('common.views.S3StorageService.health_status', fake_health_status)

    response = api_client.get('/api/content/health')

    assert response.status_code == 503
    assert response.json()['status'] == 'unhealthy'
    assert set(response.json().keys()) == {'status', 'version', 'uptime'}
