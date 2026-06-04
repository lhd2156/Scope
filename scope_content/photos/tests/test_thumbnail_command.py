from __future__ import annotations

from django.core.management import call_command


def test_scope_thumbnail_worker_command_calls_run(monkeypatch):
    from photos.management.commands import scope_thumbnail_worker

    called = []
    monkeypatch.setattr(scope_thumbnail_worker, "run", lambda: called.append(True))

    call_command("scope_thumbnail_worker")

    assert called == [True]
