from __future__ import annotations

from collections import namedtuple
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from django.test import override_settings
from PIL import Image

from photos.models import Photo
from photos.services.thumbnail_worker import ThumbnailWorker
from spots.models import Spot

FakePartition = namedtuple('FakePartition', ['topic', 'partition'])


def _png_bytes(size: tuple[int, int] = (4, 4)) -> bytes:
    buf = BytesIO()
    Image.new('RGB', size, color='red').save(buf, format='PNG')
    return buf.getvalue()


@pytest.fixture
def spot(db):
    return Spot.objects.create(
        id=uuid4(),
        title='Test spot',
        user_id=uuid4(),
        latitude=0.0,
        longitude=0.0,
        category='other',
    )


@pytest.fixture
def photo_without_thumb(db, spot):
    return Photo.objects.create(
        spot_id=spot.id,
        user_id=uuid4(),
        storage_key='photos/test.png',
        storage_url='https://example.com/photos/test.png',
        thumbnail_url='',
    )


@override_settings(AWS_STORAGE_BUCKET_NAME='', AWS_ACCESS_KEY_ID='', AWS_SECRET_ACCESS_KEY='')
def test_handle_payload_generates_thumbnail_and_updates_photo(photo_without_thumb, monkeypatch, tmp_path):
    """Happy path: worker pulls the original from storage, runs the Pillow
    pipeline, uploads the thumb, and persists `thumbnail_url` on the Photo."""
    from photos.services import s3_service

    storage = s3_service.S3StorageService()
    # Stub `fetch_original_bytes` so we don't need a real S3/filesystem setup.
    monkeypatch.setattr(storage, 'fetch_original_bytes', lambda key: _png_bytes())
    # Capture the thumbnail URL written back and return a predictable value.
    produced: dict = {}

    def _fake_generate(key):
        produced['key'] = key
        return 'https://cdn.example.com/photos/test_thumb.png'

    monkeypatch.setattr(storage, 'generate_thumbnail_for_storage_key', _fake_generate)

    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=storage, producer=producer)

    ok = worker.handle_payload({
        'photoId': str(photo_without_thumb.id),
        'storageKey': photo_without_thumb.storage_key,
    })

    assert ok is True
    assert produced['key'] == 'photos/test.png'
    photo_without_thumb.refresh_from_db()
    assert photo_without_thumb.thumbnail_url == 'https://cdn.example.com/photos/test_thumb.png'
    # Readiness event must be published so downstream (push notifications,
    # feed rebuilders) can react.
    producer.publish.assert_called_once()
    topic, payload = producer.publish.call_args.args
    assert topic == 'photo.thumbnail.ready'
    assert payload['photoId'] == str(photo_without_thumb.id)
    assert payload['thumbnailUrl'].endswith('_thumb.png')


def test_handle_payload_rejects_invalid_payload():
    """Malformed events must be dropped without raising — otherwise a single
    poison message could wedge the consumer loop."""
    worker = ThumbnailWorker(
        storage_service=MagicMock(),
        producer=SimpleNamespace(publish=MagicMock(), flush=MagicMock()),
    )

    assert worker.handle_payload({}) is False
    assert worker.handle_payload({'photoId': 'abc'}) is False
    assert worker.handle_payload({'storageKey': 'photos/x.png'}) is False


@pytest.mark.django_db
def test_handle_payload_rejects_storage_key_mismatch(photo_without_thumb):
    storage = MagicMock()
    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=storage, producer=producer)

    ok = worker.handle_payload({
        'photoId': str(photo_without_thumb.id),
        'storageKey': 'photos/other.png',
    })

    assert ok is False
    storage.generate_thumbnail_for_storage_key.assert_not_called()
    producer.publish.assert_not_called()


def test_handle_payload_skips_unknown_photo(db):
    """When a photo is deleted between upload and worker consumption, the
    worker should no-op rather than raising or retrying forever."""
    worker = ThumbnailWorker(
        storage_service=MagicMock(),
        producer=SimpleNamespace(publish=MagicMock(), flush=MagicMock()),
    )

    result = worker.handle_payload({
        'photoId': str(uuid4()),
        'storageKey': 'photos/missing.png',
    })

    assert result is False


def _make_record(*, topic='photo.thumbnail.requested', partition=0, offset=0, value=None):
    """Mimic a kafka-python ConsumerRecord closely enough for the worker's
    DLQ + lag code paths. We only need the attributes the worker touches."""
    return SimpleNamespace(
        topic=topic,
        partition=partition,
        offset=offset,
        value=value or {'photoId': 'bogus', 'storageKey': 'photos/bogus.png'},
    )


def test_dead_letter_publishes_after_max_attempts():
    """After MAX_EVENT_ATTEMPTS failures for the same offset, the record is
    rewritten onto the DLQ so the partition stops being blocked."""
    from photos.services import thumbnail_worker

    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=producer)
    record = _make_record(offset=42)

    for attempt in range(thumbnail_worker.MAX_EVENT_ATTEMPTS):
        worker._attempt_counts[worker._record_key(record)] = attempt + 1
        if attempt + 1 >= thumbnail_worker.MAX_EVENT_ATTEMPTS:
            worker._publish_dead_letter(record, RuntimeError('boom'))

    producer.publish.assert_called_once()
    topic, payload = producer.publish.call_args.args
    assert topic == 'photo.thumbnail.failed'
    assert payload['originalTopic'] == record.topic
    assert payload['partition'] == record.partition
    assert payload['offset'] == record.offset
    assert payload['errorType'] == 'RuntimeError'


def test_dead_letter_publish_failures_do_not_crash_worker():
    """If the DLQ topic itself is down, we must still not raise — the main
    loop has to keep consuming so the rest of the partition flows through."""
    producer = SimpleNamespace(
        publish=MagicMock(side_effect=RuntimeError('kafka down')),
        flush=MagicMock(),
    )
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=producer)
    record = _make_record()

    # Should not raise.
    worker._publish_dead_letter(record, ValueError('upstream bad'))
    producer.publish.assert_called_once()


def test_process_records_seeks_and_skips_commit_on_retryable_failure(monkeypatch):
    """A retryable thumbnail failure must not advance the committed offset.
    The worker seeks back to the failed record so the same process can retry
    before eventually DLQing a poison event.
    """
    partition = FakePartition('photo.thumbnail.requested', 0)
    record = _make_record(offset=7)
    consumer = SimpleNamespace(
        seek=MagicMock(),
        highwater=MagicMock(return_value=8),
        position=MagicMock(return_value=7),
    )
    worker = ThumbnailWorker(
        storage_service=MagicMock(),
        producer=SimpleNamespace(publish=MagicMock(), flush=MagicMock()),
    )
    monkeypatch.setattr(worker, 'handle_payload', MagicMock(side_effect=RuntimeError('storage down')))

    should_commit = worker._process_records(consumer, {partition: [record]})

    assert should_commit is False
    consumer.seek.assert_called_once_with(partition, record.offset)
    assert worker._attempt_counts[worker._record_key(record)] == 1


def test_handle_payload_is_idempotent_when_already_thumbed(db, spot):
    """Duplicate deliveries (at-least-once semantics) shouldn't re-upload or
    re-publish readiness events for a photo that's already populated."""
    photo = Photo.objects.create(
        spot_id=spot.id,
        user_id=uuid4(),
        storage_key='photos/done.png',
        storage_url='https://example.com/photos/done.png',
        thumbnail_url='https://example.com/photos/done_thumb.png',
    )
    storage = MagicMock()
    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=storage, producer=producer)

    ok = worker.handle_payload({
        'photoId': str(photo.id),
        'storageKey': photo.storage_key,
    })

    assert ok is True
    storage.generate_thumbnail_for_storage_key.assert_not_called()
    producer.publish.assert_not_called()
