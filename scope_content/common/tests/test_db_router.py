"""Tests for the read-replica router.

The router is stateless and depends on `settings.DATABASES` + thread-local
state only, so these tests don't need a live replica. We reconfigure
`settings.DATABASES` per-test (via override_settings) and assert on routing
decisions directly.
"""

from __future__ import annotations

from unittest import mock

import pytest
from django.test import override_settings

from common.db_router import PrimaryReplicaRouter, read_from_primary


class _FakeMeta:
    def __init__(self, app_label: str) -> None:
        self.app_label = app_label


class _FakeModel:
    def __init__(self, app_label: str) -> None:
        self._meta = _FakeMeta(app_label)


def test_writes_always_hit_default_even_when_replicas_configured():
    router = PrimaryReplicaRouter()
    with override_settings(DATABASES={'default': {}, 'replica': {}, 'replica_1': {}}):
        assert router.db_for_write(_FakeModel('spots')) == 'default'
        assert router.db_for_write(_FakeModel('auth')) == 'default'


def test_reads_fall_back_to_default_when_no_replica_configured():
    router = PrimaryReplicaRouter()
    with override_settings(DATABASES={'default': {}}):
        assert router.db_for_read(_FakeModel('spots')) == 'default'


def test_reads_route_to_a_replica_when_configured():
    router = PrimaryReplicaRouter()
    # Pin random.choice so the assertion is deterministic.
    with override_settings(DATABASES={'default': {}, 'replica': {}, 'replica_1': {}}):
        with mock.patch('common.db_router.random.choice', side_effect=lambda seq: seq[0]):
            assert router.db_for_read(_FakeModel('spots')) == 'replica'


def test_sensitive_apps_never_route_to_replica():
    router = PrimaryReplicaRouter()
    with override_settings(DATABASES={'default': {}, 'replica': {}}):
        for app in ('auth', 'admin', 'contenttypes', 'sessions'):
            assert router.db_for_read(_FakeModel(app)) == 'default', f'{app} must be primary'


def test_read_from_primary_context_pins_reads_to_default():
    router = PrimaryReplicaRouter()
    with override_settings(DATABASES={'default': {}, 'replica': {}}):
        with read_from_primary():
            assert router.db_for_read(_FakeModel('spots')) == 'default'
        # Preference is restored after the context exits.
        with mock.patch('common.db_router.random.choice', side_effect=lambda seq: seq[0]):
            assert router.db_for_read(_FakeModel('spots')) == 'replica'


def test_read_from_primary_context_nests_cleanly():
    """Nested ``with`` blocks must not clobber the outer pin on exit."""
    router = PrimaryReplicaRouter()
    with override_settings(DATABASES={'default': {}, 'replica': {}}):
        with read_from_primary():
            with read_from_primary():
                assert router.db_for_read(_FakeModel('spots')) == 'default'
            # Inner context restored, outer pin still active.
            assert router.db_for_read(_FakeModel('spots')) == 'default'


def test_allow_migrate_rejects_replica_targets():
    router = PrimaryReplicaRouter()
    assert router.allow_migrate('default', 'spots') is True
    assert router.allow_migrate('replica', 'spots') is False
    assert router.allow_migrate('replica_1', 'spots') is False


@pytest.mark.django_db
def test_integration_router_routes_real_queries_when_replicas_configured(settings):
    """End-to-end: with a replica alias wired up, querying a Django model picks
    up the router. We mirror default to avoid needing a second DB backend in
    the test harness — SQLite doesn't support true replication.
    """
    settings.DATABASES['replica'] = {
        **settings.DATABASES['default'],
        'TEST': {'MIRROR': 'default'},
    }
    settings.DATABASE_ROUTERS = ['common.db_router.PrimaryReplicaRouter']

    from spots.models import Spot

    router = PrimaryReplicaRouter()
    assert router.db_for_write(Spot) == 'default'
    # With only one replica alias, random.choice is a no-op.
    assert router.db_for_read(Spot) == 'replica'
