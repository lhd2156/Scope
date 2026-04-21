import json
import logging
from confluent_kafka import Consumer
from app.ml.feature_extraction import extract_feature_vector
from app.repositories import IntelRepository
from app.services.content_client import Spot
from config import settings

logger = logging.getLogger(__name__)


class KafkaSpotFeatureConsumer:
    topics = ["spot.created", "spot.liked", "review.created", "user.registered"]

    def __init__(self) -> None:
        self._consumer = Consumer(
            {
                "bootstrap.servers": settings.kafka_bootstrap_servers,
                "group.id": "atlas-intel",
                "auto.offset.reset": "earliest",
            }
        )

    def start(self) -> None:
        self._consumer.subscribe(self.topics)
        logger.info("kafka_consumer_started", extra={"topics": self.topics, "event_direction": "consumed"})

    def handle_message(self, topic: str, payload: dict) -> None:
        if topic == "spot.created":
            spot = Spot(
                payload["spotId"],
                payload.get("title", "Spot"),
                payload.get("description", ""),
                payload.get("category", "unknown"),
                payload.get("vibe", "neutral"),
                float(payload.get("rating", 0)),
                float(payload.get("popularity", 0)),
                float(payload.get("estimatedCost", 0)),
                float(payload.get("latitude", 0)),
                float(payload.get("longitude", 0)),
                bool(payload.get("isOutdoor", False)),
                int(payload.get("photosCount", 0)),
                tuple(payload.get("likedByUsers", [])),
            )
            IntelRepository.upsert_spot_feature(spot.spot_id, extract_feature_vector(spot), popularity_score=spot.popularity)
        elif topic == "spot.liked":
            IntelRepository.upsert_spot_feature(
                payload["spotId"],
                payload.get("featureVector", "{}"),
                popularity_score=float(payload.get("popularityScore", 1.0)),
                sentiment_score=float(payload.get("sentimentScore", 0.0)),
            )
        elif topic == "review.created":
            IntelRepository.upsert_spot_feature(
                payload["spotId"],
                payload.get("featureVector", "{}"),
                popularity_score=float(payload.get("popularityScore", 0.0)),
                sentiment_score=float(payload.get("sentimentScore", 0.5)),
            )
        elif topic == "user.registered":
            IntelRepository.upsert_preference(payload["userId"], ["culture", "food"], "medium", "moderate")

        logger.info(
            "kafka_event_consumed",
            extra={
                "topic": topic,
                "event_direction": "consumed",
                "payload_size_bytes": len(json.dumps(payload).encode("utf-8")),
            },
        )
