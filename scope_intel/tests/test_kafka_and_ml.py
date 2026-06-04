import json

from app.kafka import consumer as consumer_module
from app.kafka import producer as producer_module
from app.ml.feature_extraction import extract_feature_vector
from app.models import UserInteraction
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
        "group.id": "scope-intel",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
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


def test_kafka_consumer_handles_spot_updated_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)

    captured: dict[str, object] = {}

    def fake_extract_feature_vector(spot: Spot) -> str:
        captured["spot"] = spot
        return '{"vector": 2}'

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    monkeypatch.setattr(consumer_module, "extract_feature_vector", fake_extract_feature_vector)
    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "spot.updated",
        {
            "spotId": "spot-10",
            "title": "Updated Riverfront Picnic",
            "description": "New skyline notes",
            "category": "nature",
            "vibe": "serene",
            "rating": 4.8,
            "popularityScore": 81,
            "latitude": 32.75,
            "longitude": -97.33,
            "isOutdoor": True,
            "photosCount": 12,
            "likedByUsers": ["user-1"],
        },
    )

    updated_spot = captured["spot"]
    assert isinstance(updated_spot, Spot)
    assert updated_spot.spot_id == "spot-10"
    assert updated_spot.title == "Updated Riverfront Picnic"
    assert captured["upsert"] == ("spot-10", '{"vector": 2}', 81.0, 0.0)


def test_kafka_consumer_handles_spot_liked_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    def fake_record_interaction(user_id: str, spot_id: str, interaction_type: str, context=None, occurred_at=None, **_kwargs) -> None:
        captured["interaction"] = (user_id, spot_id, interaction_type, context, occurred_at)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)
    monkeypatch.setattr(consumer_module.IntelRepository, "record_interaction", fake_record_interaction)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "spot.liked",
        {
            "spotId": "spot-2",
            "userId": "user-1",
            "featureVector": '{"category":"culture"}',
            "popularityScore": 8,
            "sentimentScore": 0.4,
            "occurredAt": "2026-05-12T12:00:00Z",
        },
    )

    assert captured["upsert"] == ("spot-2", '{"category":"culture"}', 8.0, 0.4)
    user_id, spot_id, interaction_type, context, occurred_at = captured["interaction"]
    assert (user_id, spot_id, interaction_type, context) == ("user-1", "spot-2", "like", {"source": "spot.liked"})
    assert occurred_at is not None


def test_kafka_consumer_handles_review_created_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        captured["upsert"] = (spot_id, feature_vector, popularity_score, sentiment_score)

    def fake_record_interaction(user_id: str, spot_id: str, interaction_type: str, context=None, occurred_at=None, **_kwargs) -> None:
        captured["interaction"] = (user_id, spot_id, interaction_type, context, occurred_at)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_spot_feature", fake_upsert_spot_feature)
    monkeypatch.setattr(consumer_module.IntelRepository, "record_interaction", fake_record_interaction)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "review.created",
        {
            "reviewId": "review-1",
            "spotId": "spot-3",
            "userId": "user-2",
            "featureVector": '{"category":"outdoors"}',
            "popularityScore": 5,
            "sentimentScore": 0.9,
            "occurredAt": "2026-05-12T12:00:00Z",
        },
    )

    assert captured["upsert"] == ("spot-3", '{"category":"outdoors"}', 5.0, 0.9)
    user_id, spot_id, interaction_type, context, occurred_at = captured["interaction"]
    assert (user_id, spot_id, interaction_type, context) == (
        "user-2",
        "spot-3",
        "review",
        {"source": "review.created", "reviewId": "review-1"},
    )
    assert occurred_at is not None


def test_kafka_consumer_handles_interaction_recorded_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_record_interaction(user_id: str, spot_id: str, interaction_type: str, context=None, occurred_at=None, **_kwargs) -> None:
        captured["interaction"] = (user_id, spot_id, interaction_type, context, occurred_at)

    monkeypatch.setattr(consumer_module.IntelRepository, "record_interaction", fake_record_interaction)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message(
        "interaction.recorded",
        {
            "interactionId": "interaction-1",
            "userId": "user-4",
            "spotId": "spot-8",
            "interactionType": "save",
            "context": {"surface": "map"},
            "occurredAt": "2026-05-12T12:01:00Z",
        },
    )

    user_id, spot_id, interaction_type, context, occurred_at = captured["interaction"]
    assert (user_id, spot_id, interaction_type, context) == (
        "user-4",
        "spot-8",
        "save",
        {"surface": "map"},
    )
    assert occurred_at is not None


def test_kafka_consumer_deduplicates_replayed_interaction_envelope(app, monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    consumer = consumer_module.KafkaSpotFeatureConsumer()
    envelope = {
        "eventId": "evt-interaction-1",
        "source": "content-engine",
        "data": {
            "interactionId": "interaction-1",
            "userId": "user-4",
            "spotId": "spot-8",
            "interactionType": "save",
            "context": {"surface": "map"},
            "occurredAt": "2026-05-12T12:01:00Z",
        },
    }

    with app.app_context():
        consumer.handle_event("interaction.recorded", envelope)
        consumer.handle_event("interaction.recorded", envelope)

        rows = UserInteraction.query.all()
        assert len(rows) == 1
        assert rows[0].source_event_id == "evt-interaction-1"


def test_kafka_consumer_handles_friend_events(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: list[tuple[str, str, str]] = []

    def fake_record_friend_edge(user_id: str, friend_id: str) -> None:
        captured.append(("record", user_id, friend_id))

    def fake_remove_friend_edge(user_id: str, friend_id: str) -> None:
        captured.append(("remove", user_id, friend_id))

    monkeypatch.setattr(consumer_module.IntelRepository, "record_friend_edge", fake_record_friend_edge)
    monkeypatch.setattr(consumer_module.IntelRepository, "remove_friend_edge", fake_remove_friend_edge)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    payload = {"requesterId": "user-a", "addresseeId": "user-b"}
    consumer.handle_message("friend.accepted", payload)
    consumer.handle_message("friend.removed", payload)
    consumer.handle_message("friend.rejected", payload)

    assert captured == [
        ("record", "user-a", "user-b"),
        ("remove", "user-a", "user-b"),
        ("remove", "user-a", "user-b"),
    ]


def test_kafka_consumer_handles_user_registered_event(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    captured: dict[str, tuple] = {}

    def fake_upsert_preference(user_id: str, categories: list[str], budget_level: str | None, pace_preference: str | None) -> None:
        captured["preference"] = (user_id, categories, budget_level, pace_preference)

    monkeypatch.setattr(consumer_module.IntelRepository, "upsert_preference", fake_upsert_preference)

    consumer = consumer_module.KafkaSpotFeatureConsumer()
    consumer.handle_message("user.registered", {"userId": "user-99"})

    assert captured["preference"] == ("user-99", ["culture", "food"], "medium", "moderate")
