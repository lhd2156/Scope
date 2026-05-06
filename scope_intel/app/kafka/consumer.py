import json
import logging
from datetime import datetime

from confluent_kafka import Consumer

from app.ml.feature_extraction import extract_feature_vector
from app.repositories import IntelRepository
from app.services.content_client import Spot
from config import settings
import contextlib

logger = logging.getLogger(__name__)

# Idle poll interval in seconds. Confluent's Consumer.poll() blocks up to this
# many seconds when no messages are available; tuning this is a tradeoff
# between Kafka rebalance responsiveness and CPU idle load.
POLL_TIMEOUT_SECONDS = 1.0


class KafkaSpotFeatureConsumer:
    topics = [
        "spot.created",
        "spot.liked",
        "review.created",
        "user.registered",
        # New: emitted by the Content service every time a user views / clicks
        # / dismisses / saves a spot. Writes into `intel.UserInteractions`,
        # which the ranker reads for affinity / dismissal signals.
        "interaction.recorded",
        # New: emitted by Core when a friendship transitions state. Intel mirrors
        # accepted edges into `intel.FriendEdges` so the ranker can surface
        # "your friends liked this" candidates without cross-service joins.
        "friend.accepted",
        "friend.removed",
        "friend.rejected",
    ]

    def __init__(self) -> None:
        self._consumer = Consumer(
            {
                "bootstrap.servers": settings.kafka_bootstrap_servers,
                "group.id": "scope-intel",
                "auto.offset.reset": "earliest",
            }
        )
        self._running = False

    def start(self) -> None:
        self._consumer.subscribe(self.topics)
        logger.info("kafka_consumer_started", extra={"topics": self.topics, "event_direction": "consumed"})

    def run_forever(self) -> None:
        """Blocking consume loop. Runs until `stop()` is called or the process
        terminates. Errors in a single message handler must NOT kill the loop.

        This is what Kubernetes actually invokes via
        `python -m app.kafka.consumer_worker` -- prior to this change the
        consumer only subscribed; it never actually drained messages.
        """
        self.start()
        self._running = True
        while self._running:
            message = self._consumer.poll(POLL_TIMEOUT_SECONDS)
            if message is None:
                continue
            if message.error():
                logger.warning("kafka_poll_error", extra={"error": str(message.error())})
                continue
            topic = message.topic() or ""
            try:
                raw = message.value() or b""
                envelope = json.loads(raw.decode("utf-8") or "{}")
                # Content publishes envelope-shaped events (`eventId`, `source`,
                # `data`, ...). We unwrap `data` if present so downstream code
                # only ever handles the domain payload.
                payload = envelope.get("data", envelope) if isinstance(envelope, dict) else {}
                self.handle_message(topic, payload)
            except Exception:
                logger.exception("kafka_handler_failed", extra={"topic": topic})
                # Keep going; Kafka will move the offset forward on the next poll.
                # A dead-letter topic is the next iteration (see RESEARCH.md §6.2).
            else:
                # Explicitly advance the committed offset only after a successful
                # handler so a crash mid-process means the next pod replays.
                try:
                    self._consumer.commit(message, asynchronous=False)
                except Exception:
                    logger.warning("kafka_commit_failed", extra={"topic": topic})

    def stop(self) -> None:
        self._running = False
        with contextlib.suppress(Exception):
            self._consumer.close()

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
        elif topic == "friend.accepted":
            requester = payload.get("requesterId") or payload.get("RequesterId")
            addressee = payload.get("addresseeId") or payload.get("AddresseeId")
            if requester and addressee:
                IntelRepository.record_friend_edge(str(requester), str(addressee))
            else:
                logger.warning(
                    "kafka_friend_accepted_missing_fields",
                    extra={"payload_keys": list(payload.keys())},
                )
        elif topic in ("friend.removed", "friend.rejected"):
            requester = payload.get("requesterId") or payload.get("RequesterId")
            addressee = payload.get("addresseeId") or payload.get("AddresseeId")
            if requester and addressee:
                IntelRepository.remove_friend_edge(str(requester), str(addressee))
            else:
                logger.warning(
                    "kafka_friend_removed_missing_fields",
                    extra={"topic": topic, "payload_keys": list(payload.keys())},
                )
        elif topic == "interaction.recorded":
            occurred_at = _parse_iso_datetime(payload.get("occurredAt"))
            user_id = payload.get("userId")
            spot_id = payload.get("spotId")
            interaction_type = payload.get("interactionType")
            if not (user_id and spot_id and interaction_type):
                logger.warning(
                    "kafka_interaction_missing_fields",
                    extra={"payload_keys": list(payload.keys())},
                )
            else:
                IntelRepository.record_interaction(
                    user_id=str(user_id),
                    spot_id=str(spot_id),
                    interaction_type=str(interaction_type),
                    context=payload.get("context"),
                    occurred_at=occurred_at,
                )

        logger.info(
            "kafka_event_consumed",
            extra={
                "topic": topic,
                "event_direction": "consumed",
                "payload_size_bytes": len(json.dumps(payload).encode("utf-8")),
            },
        )


def _parse_iso_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = raw.replace("Z", "+00:00") if isinstance(raw, str) else raw
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
