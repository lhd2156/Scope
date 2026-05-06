import io
import json
import logging
from contextlib import contextmanager

from app.kafka import consumer as consumer_module
from app.kafka import producer as producer_module
from app.logging_config import SERVICE_LOGGER_NAME
from app.api import itinerary as itinerary_module


class FakeConsumer:
    def __init__(self, config: dict):
        self.config = config
        self.subscribed_topics: list[str] | None = None

    def subscribe(self, topics: list[str]) -> None:
        self.subscribed_topics = topics


class FakeProducer:
    def __init__(self, config: dict):
        self.config = config
        self.produced: list[tuple[str, bytes]] = []

    def produce(self, topic: str, payload: bytes) -> None:
        self.produced.append((topic, payload))

    def flush(self) -> None:
        return None


@contextmanager
def capture_service_logs():
    service_logger = logging.getLogger(SERVICE_LOGGER_NAME)
    handler = service_logger.handlers[0]
    stream = io.StringIO()
    original_stream = handler.stream
    handler.setStream(stream)
    try:
        yield stream
    finally:
        handler.flush()
        handler.setStream(original_stream)


def parse_log_lines(stream: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]


def test_request_logging_outputs_structured_json_with_correlation_id(client):
    with capture_service_logs() as stream:
        response = client.get("/api/intel/health", headers={"X-Correlation-Id": "corr-123"})

    assert response.status_code == 200
    logs = parse_log_lines(stream)
    request_log = next(log for log in logs if log["message"] == "request_complete")

    assert request_log["timestamp"].endswith("Z")
    assert request_log["service"] == "scope-intel"
    assert request_log["level"] == "INFO"
    assert request_log["correlation_id"] == "corr-123"
    assert request_log["method"] == "GET"
    assert request_log["path"] == "/api/intel/health"
    assert request_log["status_code"] == 200
    assert isinstance(request_log["duration_ms"], float)


def test_exception_logging_includes_request_correlation_id(client, auth_header, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(itinerary_module.engine, "generate", boom)

    with capture_service_logs() as stream:
        response = client.post(
            "/api/intel/itinerary/generate",
            json={
                "destination": "Fort Worth, TX",
                "startDate": "2026-04-01",
                "endDate": "2026-04-03",
                "budget": 500,
                "interests": ["food", "culture"],
                "pace": "moderate",
                "groupSize": 2,
            },
            headers={**auth_header, "X-Correlation-Id": "corr-exception"},
        )

    assert response.status_code == 500
    logs = parse_log_lines(stream)
    exception_log = next(log for log in logs if log["message"] == "unhandled_exception")

    assert exception_log["service"] == "scope-intel"
    assert exception_log["level"] == "ERROR"
    assert exception_log["correlation_id"] == "corr-exception"


def test_kafka_logs_use_structured_json(app, monkeypatch):
    monkeypatch.setattr(producer_module, "Producer", FakeProducer)
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    monkeypatch.setattr(consumer_module, "extract_feature_vector", lambda _spot: '{"vector": 1}')
    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", lambda *args, **kwargs: None)

    with capture_service_logs() as stream:
        producer = producer_module.KafkaEventProducer()
        producer.publish("spot.created", {"spotId": "spot-1"})

        consumer = consumer_module.KafkaSpotFeatureConsumer()
        consumer.start()
        consumer.handle_message(
            "spot.created",
            {
                "spotId": "spot-1",
                "title": "Trail",
                "description": "Sunset walk",
                "category": "outdoors",
                "vibe": "chill",
                "rating": 4.7,
                "popularity": 79,
                "estimatedCost": 0,
                "latitude": 32.7555,
                "longitude": -97.3308,
                "isOutdoor": True,
                "photosCount": 4,
                "likedByUsers": [],
            },
        )

    logs = parse_log_lines(stream)
    produced_log = next(log for log in logs if log["message"] == "kafka_event_produced")
    started_log = next(log for log in logs if log["message"] == "kafka_consumer_started")
    consumed_log = next(log for log in logs if log["message"] == "kafka_event_consumed")

    assert produced_log["service"] == "scope-intel"
    assert produced_log["topic"] == "spot.created"
    assert produced_log["event_direction"] == "produced"
    assert produced_log["payload_size_bytes"] > 0
    assert produced_log["correlation_id"] is None

    assert started_log["topics"] == consumer_module.KafkaSpotFeatureConsumer.topics
    assert started_log["event_direction"] == "consumed"

    assert consumed_log["service"] == "scope-intel"
    assert consumed_log["topic"] == "spot.created"
    assert consumed_log["event_direction"] == "consumed"
    assert consumed_log["payload_size_bytes"] > 0
