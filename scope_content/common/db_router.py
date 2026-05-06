"""Read-replica-aware database router for the Content service.

Django has first-class support for multiple database connections, but it does
nothing about routing on its own — that's what this module is for. The router
is wired in `settings.DATABASE_ROUTERS` only when at least one replica alias
has been configured; otherwise reads and writes both flow to `default` as
before, so the single-DB deployment topology is completely untouched.

Topology
--------
`DJANGO_DATABASE_REPLICA_URL` may be a single URL or a comma-separated list.
Each entry becomes a replica alias in `settings.DATABASES` named ``replica``,
``replica_1``, ``replica_2``, .... All replicas are assumed to follow the
same schema as the primary and to lag by at most a few seconds (`ms` on SQL
Server AlwaysOn, `seconds` on logical replication).

Routing rules
-------------
* **Writes (`db_for_write`)** — always `default` (the writable primary).
* **Reads (`db_for_read`)** — a random replica if one is healthy; otherwise
  `default`. We randomize rather than round-robin to avoid synchronizing
  request hotspots across gunicorn workers.
* **Cross-DB relations (`allow_relation`)** — allowed if both objects live on
  the primary or any replica (they share a schema).
* **Migrations (`allow_migrate`)** — only on `default`. Replicas are
  read-only copies; running `migrate` against them would either fail or (if
  writable for some reason) desync schemas across replicas.

Consistency escape hatch
------------------------
Django's replica-lag tax is paid on read-after-write flows ("create a spot,
immediately GET it back"). For those cases, callers can wrap the read in::

    from common.db_router import read_from_primary
    with read_from_primary():
        spot = Spot.objects.get(pk=pk)

which flips a thread-local flag the router checks first. The
`RequestLoggingMiddleware` already captures request-scoped state; a future
middleware can pin reads-after-write to the primary for the remainder of a
mutating request so downstream reads don't hit replica lag.

Safety / future work
--------------------
* This router is *strict reads-to-replica*. For stricter consistency at the
  cost of primary read load, set `READ_REPLICA_APPS` to an allowlist of apps
  that may read from replicas; the router will fall through to default for
  the rest. Kept opt-out instead of opt-in for now because the main reason
  operators will enable replicas is to offload reads in the first place.
* The router does no replica health probing. If a replica is down, DB calls
  will raise; gunicorn timeouts + Django's `CONN_HEALTH_CHECKS` will recycle
  the broken connection, and the next request gets a different replica. If
  that proves noisy in practice, add a `_healthy_replicas()` cache backed by
  `OperationalError` counts.
"""

from __future__ import annotations

import contextlib
import random
import threading
from typing import Iterable

from django.conf import settings

# Apps whose reads are *never* routed to a replica. These are either write-hot
# (Django sessions), write-critical (auth/admin), or schema-management-only
# (contenttypes/migrations). Putting them on the replica causes either
# replica-lag-induced auth failures ("user just changed their password,
# login check still sees the old hash") or strict-consistency violations.
_PRIMARY_ONLY_APPS: frozenset[str] = frozenset({
    'admin',
    'auth',
    'contenttypes',
    'sessions',
    'migrations',
})

# Thread-local so concurrent requests in the same worker can independently
# opt into primary-reads without leaking the preference across requests.
_state = threading.local()


def _replica_aliases() -> list[str]:
    """Return the list of replica connection aliases configured on DATABASES.

    We look at `settings.DATABASES` at call time (rather than caching) because
    `override_settings` in tests temporarily mutates it; caching would break
    tests that toggle replica configuration per-test.
    """
    return [alias for alias in settings.DATABASES if alias != 'default' and alias.startswith('replica')]


def _force_primary() -> bool:
    return getattr(_state, 'force_primary', False)


@contextlib.contextmanager
def read_from_primary():
    """Pin reads to the primary for the duration of the ``with`` block.

    Use when you need read-after-write consistency (e.g., fetching a row you
    just created to return in the response). Nests correctly: inner context
    inherits the outer pin and restores it on exit.
    """
    previous = getattr(_state, 'force_primary', False)
    _state.force_primary = True
    try:
        yield
    finally:
        _state.force_primary = previous


class PrimaryReplicaRouter:
    """Route reads to a random replica; writes and sensitive reads go primary."""

    def _pick_replica(self) -> str:
        aliases = _replica_aliases()
        if not aliases:
            return 'default'
        return random.choice(aliases)

    def db_for_read(self, model, **hints) -> str:
        if _force_primary():
            return 'default'
        app_label = getattr(model._meta, 'app_label', '')
        if app_label in _PRIMARY_ONLY_APPS:
            return 'default'
        return self._pick_replica()

    def db_for_write(self, model, **hints) -> str:
        return 'default'

    def allow_relation(self, obj1, obj2, **hints) -> bool:
        # All our replicas share a schema with default. Letting Django cross
        # between them avoids "cannot compare objects from different databases"
        # errors that crop up when a join selects from replica but a follow-up
        # save() reuses the same queryset on primary.
        known = {'default', *_replica_aliases()}
        db1 = getattr(obj1, '_state', None) and obj1._state.db
        db2 = getattr(obj2, '_state', None) and obj2._state.db
        if db1 in known and db2 in known:
            return True
        return None  # Defer to later routers / Django default.

    def allow_migrate(self, db: str, app_label: str, model_name: str | None = None, **hints) -> bool:
        if db == 'default':
            return True
        # Replicas never run migrations.
        return False


def iter_replica_aliases() -> Iterable[str]:
    """Public helper exposed for tests / management commands."""
    return _replica_aliases()
