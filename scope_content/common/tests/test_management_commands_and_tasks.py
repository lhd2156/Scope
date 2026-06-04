from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from django.core.management import call_command

from common import tasks
from common.models import OutboxEvent
from photos.models import Photo
from reviews.models import Review
from spots.models import Spot
from trips.models import Trip

pytestmark = pytest.mark.django_db


def _spot(**overrides):
    values = {
        "user_id": uuid.uuid4(),
        "title": "Task Spot",
        "description": "Good view",
        "latitude": 1.0,
        "longitude": 2.0,
        "category": "scenic",
    }
    values.update(overrides)
    return Spot.objects.create(**values)


class RetryProbe:
    def __init__(self):
        self.exc = None

    def retry(self, exc):
        self.exc = exc
        raise RuntimeError("retried")


def test_reindex_elasticsearch_command_indexes_all_models(monkeypatch):
    from common.management.commands import reindex_elasticsearch as command_module

    spot = _spot()
    review = Review.objects.create(spot=spot, user_id=uuid.uuid4(), rating=4.5, comment="Nice")
    trip = Trip.objects.create(creator_id=uuid.uuid4(), title="Weekend")
    calls = []

    monkeypatch.setattr(command_module, "ensure_indexes", lambda: calls.append(("ensure", None)))
    monkeypatch.setattr(command_module, "index_spot", lambda value: calls.append(("spot", value.id)))
    monkeypatch.setattr(command_module, "index_review", lambda value: calls.append(("review", value.id)))
    monkeypatch.setattr(command_module, "index_trip", lambda value: calls.append(("trip", value.id)))

    call_command("reindex_elasticsearch")

    assert calls == [
        ("ensure", None),
        ("spot", spot.id),
        ("review", review.id),
        ("trip", trip.id),
    ]


def test_replay_outbox_events_command_publishes_success_and_records_failure(monkeypatch):
    from common.management.commands import replay_outbox_events as command_module

    failed = OutboxEvent.objects.create(topic="spot.created", payload={"id": "1"}, status=OutboxEvent.STATUS_FAILED)
    pending = OutboxEvent.objects.create(topic="review.created", payload={"id": "2"}, status=OutboxEvent.STATUS_PENDING)
    calls = []

    class FakeProducer:
        def publish(self, topic, payload, *, event_id):
            calls.append((topic, payload, event_id))
            if topic == "review.created":
                raise RuntimeError("broker down")

    monkeypatch.setattr(command_module, "ScopeKafkaProducer", lambda: FakeProducer())

    call_command("replay_outbox_events", status=OutboxEvent.STATUS_FAILED, limit=5)
    failed.refresh_from_db()
    assert failed.status == OutboxEvent.STATUS_PUBLISHED
    assert failed.attempts == 1
    assert failed.last_error == ""

    call_command("replay_outbox_events", status=OutboxEvent.STATUS_PENDING, limit=5000)
    pending.refresh_from_db()
    assert pending.status == OutboxEvent.STATUS_FAILED
    assert pending.attempts == 1
    assert "broker down" in pending.last_error
    assert len(calls) == 2


def test_reindex_spot_task_success_and_retry(monkeypatch):
    spot = _spot()
    calls = []
    monkeypatch.setattr(tasks, "index_spot", lambda value: calls.append(value.id))

    assert tasks.reindex_spot_task.run(str(spot.id)) == {"status": "indexed", "spot_id": str(spot.id)}
    assert calls == [spot.id]

    retry = RetryProbe()
    monkeypatch.setattr(tasks.reindex_spot_task, "retry", retry.retry)
    with pytest.raises(RuntimeError, match="retried"):
        tasks.reindex_spot_task.run(str(uuid.uuid4()))
    assert retry.exc is not None


def test_sentiment_and_photo_classification_tasks(monkeypatch):
    spot = _spot()
    review = Review.objects.create(spot=spot, user_id=uuid.uuid4(), rating=5, comment="Loved it")
    photo = Photo.objects.create(
        spot=spot,
        user_id=uuid.uuid4(),
        storage_key="photos/1.png",
        storage_url="https://example.com/photos/1.png",
    )
    calls = []

    class FakeResponse:
        def __init__(self, ok, payload):
            self.ok = ok
            self._payload = payload

        def json(self):
            return self._payload

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers, timeout))
        if "sentiment" in url:
            return FakeResponse(True, {"score": 0.82})
        return FakeResponse(True, {"tags": ["sunset", "walk"]})

    monkeypatch.setattr(tasks.requests, "post", fake_post)
    monkeypatch.setattr(tasks, "index_review", lambda value: calls.append(("indexed-review", value.id)))

    assert tasks.analyze_review_sentiment_task.run(str(review.id)) == {
        "status": "analyzed",
        "review_id": str(review.id),
        "score": 0.82,
    }
    assert tasks.classify_photo_task.run(str(photo.id)) == {
        "status": "classified",
        "photo_id": str(photo.id),
        "tags": ["sunset", "walk"],
    }
    assert calls[0][2]["Authorization"].startswith("Bearer ")
    assert calls[0][3] == 30
    assert calls[2][2]["Authorization"].startswith("Bearer ")
    assert calls[2][3] == 60


def test_sentiment_and_photo_tasks_return_failed_on_non_ok_response(monkeypatch):
    spot = _spot()
    review = Review.objects.create(spot=spot, user_id=uuid.uuid4(), rating=4, comment="Fine")
    photo = Photo.objects.create(
        spot=spot,
        user_id=uuid.uuid4(),
        storage_key="photos/2.png",
        storage_url="https://example.com/photos/2.png",
    )

    monkeypatch.setattr(tasks.requests, "post", lambda *args, **kwargs: SimpleNamespace(ok=False, json=lambda: {}))

    assert tasks.analyze_review_sentiment_task.run(str(review.id)) == {"status": "failed", "review_id": str(review.id)}
    assert tasks.classify_photo_task.run(str(photo.id)) == {"status": "failed", "photo_id": str(photo.id)}


def test_analyze_and_classify_retry_on_exceptions(monkeypatch):
    retry = RetryProbe()
    monkeypatch.setattr(tasks.analyze_review_sentiment_task, "retry", retry.retry)
    with pytest.raises(RuntimeError, match="retried"):
        tasks.analyze_review_sentiment_task.run(str(uuid.uuid4()))
    assert retry.exc is not None

    retry = RetryProbe()
    monkeypatch.setattr(tasks.classify_photo_task, "retry", retry.retry)
    with pytest.raises(RuntimeError, match="retried"):
        tasks.classify_photo_task.run(str(uuid.uuid4()))
    assert retry.exc is not None


def test_bulk_reindex_task_indexes_each_supported_type_and_unknown(monkeypatch):
    spot = _spot()
    review = Review.objects.create(spot=spot, user_id=uuid.uuid4(), rating=4, comment="Nice")
    trip = Trip.objects.create(creator_id=uuid.uuid4(), title="Trip")
    calls = []

    monkeypatch.setattr(tasks, "ensure_indexes", lambda: calls.append(("ensure", None)))
    monkeypatch.setattr(tasks, "index_spot", lambda value: calls.append(("spot", value.id)))
    monkeypatch.setattr(tasks, "index_review", lambda value: calls.append(("review", value.id)))
    monkeypatch.setattr(tasks, "index_trip", lambda value: calls.append(("trip", value.id)))

    assert tasks.bulk_reindex_task.run("spots") == {"type": "spots", "indexed": 1}
    assert tasks.bulk_reindex_task.run("reviews") == {"type": "reviews", "indexed": 1}
    assert tasks.bulk_reindex_task.run("trips") == {"type": "trips", "indexed": 1}
    assert tasks.bulk_reindex_task.run("unknown") == {"error": "Unknown doc_type: unknown"}

    assert ("spot", spot.id) in calls
    assert ("review", review.id) in calls
    assert ("trip", trip.id) in calls


def test_intel_url_strips_api_suffix(monkeypatch):
    monkeypatch.setenv("CONTENT_SERVICE_URL", "http://intel:5000/api/content")
    assert tasks._intel_url() == "http://intel:5000"

    monkeypatch.delenv("CONTENT_SERVICE_URL")
    assert tasks._intel_url() == "http://intel:5000"
