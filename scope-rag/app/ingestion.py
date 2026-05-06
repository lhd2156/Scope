"""Kafka consumer for incremental RAG document ingestion."""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

import httpx
from confluent_kafka import Consumer

from app.config import settings
from app.vectorstore import add_document

logger = logging.getLogger(__name__)

_consumer_thread: threading.Thread | None = None


def _build_consumer() -> Consumer:
    return Consumer(
        {
            "bootstrap.servers": settings.kafka_bootstrap_servers,
            "group.id": "scope-rag",
            "auto.offset.reset": "latest",
        }
    )


def _spot_text(spot: dict[str, Any]) -> str:
    parts = [
        spot.get("title") or spot.get("name") or "",
        spot.get("description") or "",
        spot.get("category") or "",
        spot.get("vibe") or "",
        spot.get("city") or "",
        spot.get("country") or "",
    ]
    return " ".join(part for part in parts if part).strip()


def _spot_metadata(spot: dict[str, Any]) -> dict[str, Any]:
    return {
        "spot_id": str(spot.get("id", "")),
        "spot_name": spot.get("title") or spot.get("name") or "Unknown Spot",
        "rating": spot.get("rating") or spot.get("average_rating"),
        "category": spot.get("category"),
        "city": spot.get("city"),
        "country": spot.get("country"),
        "source": "spot",
    }


def _review_text(review: dict[str, Any]) -> str:
    return review.get("comment") or review.get("text") or ""


def _review_metadata(review: dict[str, Any], spot: dict[str, Any]) -> dict[str, Any]:
    return {
        "review_id": str(review.get("id", "")),
        "spot_id": str(spot.get("id", "")),
        "spot_name": spot.get("title") or spot.get("name") or "Unknown Spot",
        "rating": review.get("rating"),
        "category": spot.get("category"),
        "city": spot.get("city"),
        "country": spot.get("country"),
        "source": "review",
    }


def _fetch_json(client: httpx.Client, path: str) -> dict[str, Any]:
    response = client.get(f"{settings.content_service_url}{path}", timeout=10)
    response.raise_for_status()
    return response.json()


def _ingest_spot(payload: dict[str, Any]) -> None:
    spot_id = payload.get("spotId") or payload.get("spot_id")
    if not spot_id:
        return

    with httpx.Client() as client:
        body = _fetch_json(client, f"/spots/{spot_id}")
        spot = body.get("data") or body

    text = _spot_text(spot)
    if text:
        add_document(f"spot:{spot_id}", text, _spot_metadata(spot))


def _ingest_review(payload: dict[str, Any]) -> None:
    review_id = payload.get("reviewId") or payload.get("review_id")
    spot_id = payload.get("spotId") or payload.get("spot_id")
    if not review_id or not spot_id:
        return

    with httpx.Client() as client:
        spot_body = _fetch_json(client, f"/spots/{spot_id}")
        reviews_body = _fetch_json(client, f"/reviews/spot/{spot_id}")
        spot = spot_body.get("data") or spot_body
        reviews = reviews_body.get("data") or []

    review = next((item for item in reviews if str(item.get("id")) == str(review_id)), None)
    if review is None:
        return

    text = _review_text(review)
    if text:
        add_document(f"review:{review_id}", text, _review_metadata(review, spot))


def process_message(topic: str, payload: dict[str, Any]) -> None:
    """Process a Kafka message into the vector store."""
    if topic == "spot.created":
        _ingest_spot(payload)
    elif topic == "review.created":
        _ingest_review(payload)


def consume_forever() -> None:
    """Consume spot/review creation events and ingest them into Chroma."""
    if not settings.kafka_enabled:
        logger.info("RAG ingestion disabled because kafka_enabled=false")
        return

    consumer = _build_consumer()
    consumer.subscribe(["spot.created", "review.created"])
    logger.info("RAG ingestion consumer subscribed")

    try:
        while True:
            message = consumer.poll(1.0)
            if message is None:
                continue
            if message.error():
                logger.warning("RAG consumer error: %s", message.error())
                continue

            try:
                payload = json.loads(message.value().decode("utf-8"))
            except Exception:
                logger.exception("Failed to decode RAG ingestion payload")
                continue

            try:
                process_message(message.topic(), payload)
            except Exception:
                logger.exception("Failed to ingest RAG payload from topic %s", message.topic())
    finally:
        consumer.close()


def start_background_consumer() -> threading.Thread | None:
    """Start Kafka ingestion in a daemon thread."""
    global _consumer_thread
    if _consumer_thread is not None and _consumer_thread.is_alive():
        return _consumer_thread
    if not settings.kafka_enabled:
        return None

    _consumer_thread = threading.Thread(target=consume_forever, name="scope-rag-consumer", daemon=True)
    _consumer_thread.start()
    return _consumer_thread
