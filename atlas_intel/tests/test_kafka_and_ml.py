import json

from app.kafka import consumer as consumer_module
from app.kafka import producer as producer_module
from app.ml.feature_extraction import extract_feature_vector
from app.services.content_client import Spot


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
        self.flush_calls = 0

    def produce(self, topic: str, payload: bytes) -> None:
        self.produced.append((topic, payload))

    def flush(self) -> None:
        self.flush_calls += 1


def test_extract_feature_vector_serializes_expected_spot_fields():
    spot = Spot(
        "spot-1",
        "Trinity Trails Sunset",
        "Scenic river walk and cycling trail",
        "outdoors",
        "chill",
        4.7,
        79,
        0,
        32.7507,
        -97.3511,
        True,
        27,
        ("user-1", "user-4"),
    )

    payload = json.loads(extract_feature_vector(spot))

    assert payload == {
        "category": "outdoors",
        "vibe": "chill",
        "rating": 4.7,
        "popularity": 79,
        "photosCount": 27,
        "isOutdoor": True,
    }


def test_kafka_event_producer_publishes_json_payload_and_flushes(monkeypatch):
    monkeypatch.setattr(producer_module, "Producer", FakeProducer)

    producer = producer_module.KafkaEventProducer()
    producer.publish("spot.created", {"spotId": "spot-1", "title": "Trail"})

    assert producer._producer.config["bootstrap.servers"] == producer_module.settings.kafka_bootstrap_servers
    assert producer._producer.produced == [("spot.created", b'{"spotId": "spot-1", "title": "Trail"}')]
    assert producer._producer.flush_calls == 1


def test_kafka_consumer_start_subscribes_to_all_topics(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.start()

    assert consumer._consumer.config == {
        "bootstrap.servers": consumer_module.settings.kafka_bootstrap_servers,
        "group.id": "atlas-intel",
        "auto.offset.reset": "earliest",
    }
    assert consumer._consumer.subscribed_topics == consumer_module.KafkaSpotFeatureConsumer.topics


def test_kafka_consumer_handles_spot_created_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)

    captured: dict[str, object] = {}

    def fake_extract_feature_vector(spot: Spot) -> str:
        captured["spot"] = spot
        return '{"vector": 1}'

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    monkeypatch.setattr(consumer_module, "extract_feature_vector", fake_extract_feature_vector)
    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "spot.created",
        {
            "spotId": "spot-9",
            "title": "Riverfront Picnic",
            "description": "Picnic tables and skyline views",
            "category": "nature",
            "vibe": "serene",
            "rating": 4.6,
            "popularity": 73,
            "estimatedCost": 12,
            "latitude": 32.75,
            "longitude": -97.33,
            "isOutdoor": True,
            "photosCount": 11,
            "likedByUsers": ["user-1", "user-7"],
        },
    )

    created_spot = captured["spot"]
    assert isinstance(created_spot, Spot)
    assert created_spot.spot_id == "spot-9"
    assert created_spot.title == "Riverfront Picnic"
    assert created_spot.liked_by_users == ("user-1", "user-7")
    assert captured["upsert"] == ("spot-9", '{"vector": 1}', 73.0, 0.0)


def test_kafka_consumer_handles_spot_liked_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "spot.liked",
        {"spotId": "spot-2", "featureVector": '{"category":"culture"}', "popularityScore": 8, "sentimentScore": 0.4},
    )

    assert captured["upsert"] == ("spot-2", '{"category":"culture"}', 8.0, 0.4)


def test_kafka_consumer_handles_review_created_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "review.created",
        {"spotId": "spot-3", "featureVector": '{"category":"outdoors"}', "popularityScore": 5, "sentimentScore": 0.9},
    )

    assert captured["upsert"] == ("spot-3", '{"category":"outdoors"}', 5.0, 0.9)


def test_kafka_consumer_handles_user_registered_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_preference(user_id: str, categories: list[str], budget_level: str | None, pace_preference: str | None) -> None:
        captured["preference"] = (user_id, categories, budget_level, pace_preference)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_preference", fake_upsert_preference)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message("user.registered", {"userId": "user-99"})

    assert captured["preference"] == ("user-99", ["culture", "food"], "medium", "moderate")
