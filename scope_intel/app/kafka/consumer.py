import json
import logging
from datetime import datetime

try:
    from confluent_kafka import Consumer
except ImportError:
    class Consumer:
        def __init__(self, *_args, **_kwargs) -> None:
            raise RuntimeError("confluent_kafka is not installed; Kafka consumer is unavailable")

from app.ml.feature_extraction import extract_feature_vector
from app.repositories import IntelRepository
from app.services.content_client import ContentServiceClient, Spot
from config import settings
import contextlib
from flask import has_app_context

logger = logging.getLogger(__name__)

# Idle poll interval in seconds. Confluent's Consumer.poll() blocks up to this
# many seconds when no messages are available; tuning this is a tradeoff
# between Kafka rebalance responsiveness and CPU idle load.
POLL_TIMEOUT_SECONDS = 1.0


class KafkaSpotFeatureConsumer:
    topics = [
        "spot.created",
        "spot.updated",
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
                "enable.auto.commit": False,
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
                self.handle_event(topic, envelope)
            except Exception:
                logger.exception("kafka_handler_failed", extra={"topic": topic})
                # Keep going; Kafka will move the offset forward on the next poll.
                # A dead-letter topic is the next reliability improvement.
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

    def handle_event(self, topic: str, envelope: dict) -> None:
        """Handle a Kafka envelope without losing replay identity.

        Content publishes `eventId` + `data`. Core currently publishes raw
        domain payloads. This accepts both shapes and passes the event id down
        only when one is present.
        """
        if not isinstance(envelope, dict):
            self.handle_message(topic, {})
            return

        payload = envelope.get("data", envelope)
        if not isinstance(payload, dict):
            payload = {}
        event_id = envelope.get("eventId") or payload.get("eventId")
        self.handle_message(topic, payload, event_id=str(event_id) if event_id else None)

    def handle_message(self, topic: str, payload: dict, event_id: str | None = None) -> None:
        if topic in ("spot.created", "spot.updated"):
            spot = _spot_from_payload_or_content(payload)
            if spot is None:
                logger.warning("kafka_spot_event_missing_spot", extra={"topic": topic, "payload_keys": list(payload.keys())})
            else:
                IntelRepository.upsert_spot_feature(
                    spot.spot_id,
                    extract_feature_vector(spot),
                    popularity_score=_payload_float(payload, "popularityScore", spot.popularity),
                    sentiment_score=_payload_float(payload, "sentimentScore", 0.0),
                )
        elif topic == "spot.liked":
            spot_id = _payload_spot_id(payload)
            user_id = payload.get("userId")
            spot = _spot_from_payload_or_content(payload)
            if payload.get("featureVector"):
                feature_vector = payload.get("featureVector", "{}")
                popularity_score = _payload_float(payload, "popularityScore", 1.0)
            elif spot is not None:
                feature_vector = extract_feature_vector(spot)
                popularity_score = _payload_float(payload, "popularityScore", max(spot.popularity, 1.0))
            else:
                feature_vector = payload.get("featureVector", "{}")
                popularity_score = _payload_float(payload, "popularityScore", 1.0)
            if spot_id:
                IntelRepository.upsert_spot_feature(
                    spot_id,
                    feature_vector,
                    popularity_score=popularity_score,
                    sentiment_score=_payload_float(payload, "sentimentScore", 0.0),
                )
            if user_id and spot_id:
                _record_interaction(
                    user_id=str(user_id),
                    spot_id=str(spot_id),
                    interaction_type="like",
                    context={"source": "spot.liked"},
                    occurred_at=_parse_iso_datetime(payload.get("occurredAt")),
                    source_event_id=event_id,
                )
        elif topic == "review.created":
            spot_id = _payload_spot_id(payload)
            if not spot_id:
                logger.warning("kafka_review_missing_spot_id", extra={"payload_keys": list(payload.keys())})
                spot_id = ""
            spot = _spot_from_payload_or_content(payload)
            feature_vector = payload.get("featureVector") or (extract_feature_vector(spot) if spot is not None else "{}")
            if spot_id:
                IntelRepository.upsert_spot_feature(
                    spot_id,
                    feature_vector,
                    popularity_score=float(payload.get("popularityScore", 0.0)),
                    sentiment_score=float(payload.get("sentimentScore", 0.5)),
                )
            user_id = payload.get("userId")
            if user_id and spot_id:
                _record_interaction(
                    user_id=str(user_id),
                    spot_id=str(spot_id),
                    interaction_type="review",
                    context={"source": "review.created", "reviewId": payload.get("reviewId")},
                    occurred_at=_parse_iso_datetime(payload.get("occurredAt")),
                    source_event_id=event_id or payload.get("reviewId"),
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
                _record_interaction(
                    user_id=str(user_id),
                    spot_id=str(spot_id),
                    interaction_type=str(interaction_type),
                    context=payload.get("context"),
                    occurred_at=occurred_at,
                    source_event_id=event_id or payload.get("interactionId"),
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


def _payload_spot_id(payload: dict) -> str:
    return str(payload.get("spotId") or payload.get("spot_id") or payload.get("id") or "").strip()


def _payload_float(payload: dict, key: str, default: float = 0.0) -> float:
    try:
        return float(payload.get(key, default))
    except (TypeError, ValueError):
        return default


def _payload_int(payload: dict, key: str, default: int = 0) -> int:
    try:
        return int(float(payload.get(key, default)))
    except (TypeError, ValueError):
        return default


def _spot_from_payload_or_content(payload: dict) -> Spot | None:
    spot_id = _payload_spot_id(payload)
    if not spot_id:
        return None

    if has_app_context():
        try:
            hydrated = ContentServiceClient().get_spot(spot_id)
        except Exception:
            logger.warning("kafka_spot_hydration_failed", extra={"spot_id": spot_id})
            hydrated = None
        if hydrated is not None:
            return hydrated

    return Spot(
        spot_id,
        str(payload.get("title") or "Spot"),
        str(payload.get("description") or ""),
        str(payload.get("category") or "unknown"),
        str(payload.get("vibe") or "neutral"),
        _payload_float(payload, "rating", 0.0),
        _payload_float(payload, "popularity", _payload_float(payload, "popularityScore", 0.0)),
        _payload_float(payload, "estimatedCost", 0.0),
        _payload_float(payload, "latitude", 0.0),
        _payload_float(payload, "longitude", 0.0),
        bool(payload.get("isOutdoor", False)),
        _payload_int(payload, "photosCount", 0),
        tuple(str(user_id) for user_id in payload.get("likedByUsers", []) or ()),
    )


def _record_interaction(
    *,
    user_id: str,
    spot_id: str,
    interaction_type: str,
    context: dict | None = None,
    occurred_at: datetime | None = None,
    source_event_id: str | None = None,
) -> None:
    kwargs = {
        "user_id": user_id,
        "spot_id": spot_id,
        "interaction_type": interaction_type,
        "context": context,
        "occurred_at": occurred_at,
    }
    if source_event_id:
        kwargs["source_event_id"] = str(source_event_id)
    IntelRepository.record_interaction(**kwargs)
