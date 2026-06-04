import json
from types import SimpleNamespace

import pytest

from app import ingestion


def test_spot_and_review_helpers_build_search_text_and_metadata():
    spot = {
        "id": 42,
        "name": "Sunset Bluff",
        "description": "Wide-open overlook",
        "category": "viewpoint",
        "vibe": "quiet",
        "city": "Sedona",
        "country": "US",
        "average_rating": 4.7,
    }

    assert ingestion._spot_text(spot) == "Sunset Bluff Wide-open overlook viewpoint quiet Sedona US"
    assert ingestion._spot_metadata(spot) == {
        "spot_id": "42",
        "spot_name": "Sunset Bluff",
        "rating": 4.7,
        "category": "viewpoint",
        "city": "Sedona",
        "country": "US",
        "source": "spot",
    }

    review = {"id": "r-1", "text": "Perfect at golden hour.", "rating": 5}
    assert ingestion._review_text(review) == "Perfect at golden hour."
    assert ingestion._review_metadata(review, spot)["spot_name"] == "Sunset Bluff"


def test_fetch_json_calls_content_service_and_raises_on_bad_status(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "content_service_url", "https://content.test/api/content")
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            captured["raised"] = False

        def json(self):
            return {"data": {"id": 7}}

    class FakeClient:
        def get(self, url, timeout):
            captured["url"] = url
            captured["timeout"] = timeout
            return FakeResponse()

    assert ingestion._fetch_json(FakeClient(), "/spots/7") == {"data": {"id": 7}}
    assert captured == {
        "url": "https://content.test/api/content/spots/7",
        "timeout": 10,
        "raised": False,
    }


def test_ingest_spot_fetches_spot_and_adds_document(monkeypatch):
    captured = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url, timeout):
            return SimpleNamespace(
                raise_for_status=lambda: None,
                json=lambda: {
                    "data": {
                        "id": "spot-9",
                        "title": "River Walk",
                        "description": "Easy water-side stroll",
                        "category": "walk",
                    }
                },
            )

    monkeypatch.setattr(ingestion.httpx, "Client", FakeClient)
    monkeypatch.setattr(
        ingestion,
        "add_document",
        lambda doc_id, text, metadata: captured.update({"doc_id": doc_id, "text": text, "metadata": metadata}),
    )

    ingestion._ingest_spot({"spotId": "spot-9"})

    assert captured["doc_id"] == "spot:spot-9"
    assert "River Walk" in captured["text"]
    assert captured["metadata"]["source"] == "spot"


def test_ingest_spot_ignores_missing_id_and_empty_text(monkeypatch):
    monkeypatch.setattr(ingestion.httpx, "Client", lambda: (_ for _ in ()).throw(AssertionError("client should not open")))
    ingestion._ingest_spot({})

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url, timeout):
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"data": {"id": "spot-1"}})

    monkeypatch.setattr(ingestion.httpx, "Client", FakeClient)
    monkeypatch.setattr(ingestion, "add_document", lambda *args: (_ for _ in ()).throw(AssertionError("empty text should not be indexed")))

    ingestion._ingest_spot({"spot_id": "spot-1"})


def test_ingest_review_fetches_matching_review_and_adds_document(monkeypatch):
    captured = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url, timeout):
            if url.endswith("/spots/spot-4"):
                payload = {"data": {"id": "spot-4", "title": "Canyon Rim", "category": "hike"}}
            else:
                payload = {
                    "data": [
                        {"id": "other", "comment": "Not this one", "rating": 2},
                        {"id": "review-8", "comment": "Worth the climb.", "rating": 5},
                    ]
                }
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: payload)

    monkeypatch.setattr(ingestion.httpx, "Client", FakeClient)
    monkeypatch.setattr(
        ingestion,
        "add_document",
        lambda doc_id, text, metadata: captured.update({"doc_id": doc_id, "text": text, "metadata": metadata}),
    )

    ingestion._ingest_review({"reviewId": "review-8", "spotId": "spot-4"})

    assert captured["doc_id"] == "review:review-8"
    assert captured["text"] == "Worth the climb."
    assert captured["metadata"]["rating"] == 5
    assert captured["metadata"]["source"] == "review"


def test_ingest_review_ignores_incomplete_missing_and_empty_reviews(monkeypatch):
    monkeypatch.setattr(ingestion.httpx, "Client", lambda: (_ for _ in ()).throw(AssertionError("client should not open")))
    ingestion._ingest_review({"reviewId": "r-1"})

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, url, timeout):
            if url.endswith("/spots/spot-4"):
                payload = {"data": {"id": "spot-4", "title": "Canyon Rim"}}
            else:
                payload = {"data": [{"id": "review-8", "comment": "", "rating": 5}]}
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: payload)

    monkeypatch.setattr(ingestion.httpx, "Client", FakeClient)
    monkeypatch.setattr(ingestion, "add_document", lambda *args: (_ for _ in ()).throw(AssertionError("review should not be indexed")))

    ingestion._ingest_review({"reviewId": "missing", "spotId": "spot-4"})
    ingestion._ingest_review({"reviewId": "review-8", "spotId": "spot-4"})


def test_process_message_dispatches_supported_topics(monkeypatch):
    calls = []
    monkeypatch.setattr(ingestion, "_ingest_spot", lambda payload: calls.append(("spot", payload)))
    monkeypatch.setattr(ingestion, "_ingest_review", lambda payload: calls.append(("review", payload)))

    ingestion.process_message("spot.created", {"spotId": "1"})
    ingestion.process_message("review.created", {"reviewId": "2"})
    ingestion.process_message("other.topic", {"id": "ignored"})

    assert calls == [("spot", {"spotId": "1"}), ("review", {"reviewId": "2"})]


def test_consume_forever_handles_poll_decode_and_processing_errors(monkeypatch):
    closed = {"value": False}
    processed = []

    class FakeMessage:
        def __init__(self, topic="spot.created", value=b"{}", error=None):
            self._topic = topic
            self._value = value
            self._error = error

        def topic(self):
            return self._topic

        def value(self):
            return self._value

        def error(self):
            return self._error

    class FakeConsumer:
        def __init__(self):
            self.messages = iter(
                [
                    None,
                    FakeMessage(error="partition eof"),
                    FakeMessage(value=b"{not json"),
                    FakeMessage(value=json.dumps({"spotId": "9"}).encode("utf-8")),
                    FakeMessage(topic="review.created", value=json.dumps({"reviewId": "r"}).encode("utf-8")),
                    KeyboardInterrupt(),
                ]
            )

        def subscribe(self, topics):
            self.topics = topics

        def poll(self, timeout):
            item = next(self.messages)
            if isinstance(item, BaseException):
                raise item
            return item

        def close(self):
            closed["value"] = True

    def fake_process(topic, payload):
        processed.append((topic, payload))
        if topic == "review.created":
            raise RuntimeError("boom")

    monkeypatch.setattr(ingestion.settings, "kafka_enabled", True)
    monkeypatch.setattr(ingestion, "_build_consumer", FakeConsumer)
    monkeypatch.setattr(ingestion, "process_message", fake_process)

    with pytest.raises(KeyboardInterrupt):
        ingestion.consume_forever()

    assert processed == [
        ("spot.created", {"spotId": "9"}),
        ("review.created", {"reviewId": "r"}),
    ]
    assert closed["value"] is True


def test_consume_forever_and_background_start_respect_kafka_settings(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "kafka_enabled", False)
    monkeypatch.setattr(ingestion, "_build_consumer", lambda: (_ for _ in ()).throw(AssertionError("disabled")))
    assert ingestion.consume_forever() is None
    assert ingestion.start_background_consumer() is None

    class ExistingThread:
        def is_alive(self):
            return True

    existing = ExistingThread()
    monkeypatch.setattr(ingestion.settings, "kafka_enabled", True)
    monkeypatch.setattr(ingestion, "_consumer_thread", existing)
    assert ingestion.start_background_consumer() is existing

    class FakeThread:
        def __init__(self, target, name, daemon):
            self.target = target
            self.name = name
            self.daemon = daemon
            self.started = False

        def is_alive(self):
            return False

        def start(self):
            self.started = True

    monkeypatch.setattr(ingestion, "_consumer_thread", None)
    monkeypatch.setattr(ingestion.threading, "Thread", FakeThread)

    created = ingestion.start_background_consumer()

    assert created.name == "scope-rag-consumer"
    assert created.daemon is True
    assert created.started is True
