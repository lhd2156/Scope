from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from common.kafka_producer import ScopeKafkaProducer
from common.models import OutboxEvent

logger = logging.getLogger(__name__)


def flush_producer(producer: ScopeKafkaProducer) -> None:
    flush = getattr(producer, 'flush', None)
    if callable(flush):
        flush(timeout=getattr(settings, 'KAFKA_PUBLISH_FLUSH_TIMEOUT_SECONDS', 5))


def record_and_publish(producer: ScopeKafkaProducer, topic: str, data: dict[str, Any]) -> OutboxEvent:
    """Persist a replayable event before handing it to Kafka.

    The Content Engine writes user-facing mutations and domain events in the
    same database transaction. Kafka publishing happens after commit so a
    rolled-back write cannot leak a notification, while failed sends remain in
    ``common.OutboxEvent`` for replay.
    """

    outbox_event = OutboxEvent.objects.create(
        topic=topic,
        payload=data,
        status=OutboxEvent.STATUS_PENDING,
    )

    def publish_committed_event() -> None:
        try:
            producer.publish(topic, data, event_id=str(outbox_event.event_id))
            flush_producer(producer)
            OutboxEvent.objects.filter(pk=outbox_event.pk).update(
                status=OutboxEvent.STATUS_PUBLISHED,
                attempts=F('attempts') + 1,
                last_error='',
                published_at=timezone.now(),
                updated_at=timezone.now(),
            )
        except Exception as exc:  # pragma: no cover - exercised with real broker outages
            logger.exception(
                'content_outbox_publish_failed',
                extra={'topic': topic, 'event_id': str(outbox_event.event_id)},
            )
            OutboxEvent.objects.filter(pk=outbox_event.pk).update(
                status=OutboxEvent.STATUS_FAILED,
                attempts=F('attempts') + 1,
                last_error=str(exc)[:1000],
                updated_at=timezone.now(),
            )

    if getattr(settings, 'OUTBOX_PUBLISH_INLINE', False):
        publish_committed_event()
    else:
        transaction.on_commit(publish_committed_event)
    return outbox_event
