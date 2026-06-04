from __future__ import annotations

import sys
import types
from collections import namedtuple
from types import SimpleNamespace
from unittest.mock import MagicMock

from django.test import override_settings

from photos.services import thumbnail_worker
from photos.services.thumbnail_worker import ThumbnailWorker

FakePartition = namedtuple("FakePartition", ["topic", "partition"])


def _record(topic="photo.thumbnail.requested", partition=0, offset=0, value=None):
    return SimpleNamespace(topic=topic, partition=partition, offset=offset, value=value or {"photoId": "p", "storageKey": "k"})


def test_process_records_commits_success_and_records_lag(monkeypatch):
    partition = FakePartition("photo.thumbnail.requested", 2)
    record = _record(offset=9)
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=SimpleNamespace(publish=MagicMock(), flush=MagicMock()))
    consumer = SimpleNamespace(highwater=MagicMock(return_value=15), position=MagicMock(return_value=10))
    consumed = []
    lags = []

    monkeypatch.setattr(worker, "handle_payload", lambda payload: True)
    monkeypatch.setattr(thumbnail_worker, "record_kafka_consumed", lambda *args, **kwargs: consumed.append((args, kwargs)))
    monkeypatch.setattr(thumbnail_worker, "record_kafka_consumer_lag", lambda *args: lags.append(args))

    assert worker._process_records(consumer, {partition: [record]}) is True
    assert consumed[0][1] == {"status": "ok"}
    assert lags == [("photo.thumbnail.requested", 2, worker.consumer_group, 5)]


def test_process_records_dlqs_after_max_attempts_without_seek(monkeypatch):
    partition = FakePartition("photo.thumbnail.requested", 0)
    record = _record(offset=3)
    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=producer)
    worker._attempt_counts[worker._record_key(record)] = thumbnail_worker.MAX_EVENT_ATTEMPTS - 1
    consumer = SimpleNamespace(seek=MagicMock(), highwater=MagicMock(return_value=None), position=MagicMock(return_value=None))

    monkeypatch.setattr(worker, "handle_payload", MagicMock(side_effect=RuntimeError("bad image")))

    assert worker._process_records(consumer, {partition: [record]}) is True
    consumer.seek.assert_not_called()
    assert producer.publish.call_args.args[0] == thumbnail_worker.THUMBNAIL_FAILED_TOPIC


@override_settings(KAFKA_ENABLED=False)
def test_run_forever_returns_when_kafka_disabled():
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=SimpleNamespace(publish=MagicMock(), flush=MagicMock()))
    assert worker.run_forever() is None


@override_settings(KAFKA_ENABLED=True, KAFKA_BOOTSTRAP_SERVERS="kafka-a:9092,kafka-b:9092")
def test_run_forever_polls_commits_closes_and_flushes(monkeypatch):
    commits = []
    closed = []

    class FakeConsumer:
        def __init__(self, *args, **kwargs):
            self.kwargs = kwargs
            self.polls = 0

        def poll(self, timeout_ms):
            self.polls += 1
            if self.polls == 1:
                return {}
            worker.request_shutdown()
            return {"partition": [_record()]}

        def commit(self):
            commits.append(True)

        def close(self):
            closed.append(True)

    fake_kafka = types.SimpleNamespace(KafkaConsumer=FakeConsumer)
    monkeypatch.setitem(sys.modules, "kafka", fake_kafka)
    monkeypatch.setattr(thumbnail_worker.time, "sleep", lambda seconds: None)
    monkeypatch.setattr(thumbnail_worker.signal, "signal", lambda *args, **kwargs: None)

    producer = SimpleNamespace(publish=MagicMock(), flush=MagicMock())
    worker = ThumbnailWorker(storage_service=MagicMock(), producer=producer)
    monkeypatch.setattr(worker, "_process_records", lambda consumer, records: True)

    worker.run_forever(poll_timeout_ms=5, idle_sleep_seconds=0)

    assert commits == [True]
    assert closed == [True]
    producer.flush.assert_called_once()
