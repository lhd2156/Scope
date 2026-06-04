"""Background thumbnail generation pulled into its own module so the loop can
be exercised by unit tests without the Django management-command wrapping.

Event contract (topic `photo.thumbnail.requested`):

    {
        "photoId": "<uuid>",
        "storageKey": "photos/<uuid>.<ext>",
        "spotId": "<uuid>",
        "userId": "<uuid>"
    }

The worker is idempotent: on retry it will overwrite the thumb at the target
storage key and update `Photo.thumbnail_url`. Kafka delivers at-least-once,
so the idempotency check (`if photo.thumbnail_url`) keeps retries bounded.

Poison-message handling
-----------------------
A record that raises `MAX_EVENT_ATTEMPTS` times in a row is rewritten onto
`photo.thumbnail.failed` (the DLQ) with enough metadata to replay or
investigate later, and the main stream continues. Without this, a single
corrupt image in S3 could block its partition forever. We track per-offset
failure counts in memory; a rebalance / worker restart will reset them,
which is intentional — we don't want a DLQ-rewrite decision to outlive a
process that can't see the failure in context.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import time
from typing import Any

from django.conf import settings

from common.kafka_producer import ScopeKafkaProducer
from common.telemetry import (
    record_kafka_consumed,
    record_kafka_consumer_lag,
)
from photos.models import Photo
from photos.services.s3_service import S3StorageService

logger = logging.getLogger(__name__)

THUMBNAIL_REQUESTED_TOPIC = 'photo.thumbnail.requested'
THUMBNAIL_READY_TOPIC = 'photo.thumbnail.ready'
THUMBNAIL_FAILED_TOPIC = 'photo.thumbnail.failed'
DEFAULT_CONSUMER_GROUP = 'scope-content-thumbnail-worker'
# After this many consecutive failures for the same offset, we stop retrying
# in-place and publish to the DLQ. 3 covers a transient S3 hiccup without
# pinning the worker on a permanently corrupt image.
MAX_EVENT_ATTEMPTS = int(os.getenv('SCOPE_THUMBNAIL_WORKER_MAX_ATTEMPTS', '3'))


class ThumbnailWorker:
    """Consumes `photo.thumbnail.requested`, generates + uploads the thumb,
    and updates the Photo row. Optionally emits `photo.thumbnail.ready` for
    downstream fan-out (e.g. push notifications, feed updates).
    """

    def __init__(
        self,
        *,
        storage_service: S3StorageService | None = None,
        producer: ScopeKafkaProducer | None = None,
        consumer_group: str | None = None,
    ) -> None:
        self.storage_service = storage_service or S3StorageService()
        self.producer = producer or ScopeKafkaProducer()
        self.consumer_group = consumer_group or os.getenv(
            'SCOPE_THUMBNAIL_WORKER_GROUP', DEFAULT_CONSUMER_GROUP
        )
        self._shutdown = False
        # {(topic, partition, offset): attempts}. In-memory only; a restart
        # resets counts so we're not permanently blocked on a previously-flaky
        # record. Bounded implicitly by committing offsets after handling —
        # failed offsets that don't advance get overwritten on retry.
        self._attempt_counts: dict[tuple[str, int, int], int] = {}

    def _record_key(self, record: Any) -> tuple[str, int, int]:
        return (record.topic, record.partition, record.offset)

    def _publish_dead_letter(self, record: Any, error: BaseException) -> None:
        """Rewrite a poison event onto the DLQ so the main stream can advance.

        Includes the raw payload + enough routing metadata (topic / partition
        / offset) to replay via a one-off script once the underlying issue is
        fixed. Errors are stringified so a non-serializable exception can't
        cause the DLQ publish itself to fail.
        """
        try:
            self.producer.publish(
                THUMBNAIL_FAILED_TOPIC,
                {
                    'originalTopic': record.topic,
                    'partition': record.partition,
                    'offset': record.offset,
                    'payload': record.value,
                    'error': str(error),
                    'errorType': type(error).__name__,
                    'consumerGroup': self.consumer_group,
                },
            )
            logger.warning(
                'thumbnail_worker_dlq_published',
                extra={
                    'topic': record.topic,
                    'partition': record.partition,
                    'offset': record.offset,
                    'error_type': type(error).__name__,
                },
            )
        except Exception:  # pragma: no cover - DLQ publish is last-resort
            logger.exception(
                'thumbnail_worker_dlq_publish_failed',
                extra={'partition': record.partition, 'offset': record.offset},
            )

    def request_shutdown(self, *_args: Any) -> None:
        """Signal handler: complete the in-flight event then exit cleanly."""
        logger.info('thumbnail_worker_shutdown_requested')
        self._shutdown = True

    def handle_payload(self, payload: dict) -> bool:
        """Process a single event payload. Returns True on success, False if
        the event was malformed or the photo no longer exists (non-retryable).
        """
        photo_id = payload.get('photoId')
        storage_key = payload.get('storageKey')
        if not photo_id or not storage_key:
            logger.warning('thumbnail_worker_invalid_payload', extra={'payload': payload})
            return False

        try:
            photo = Photo.objects.get(pk=photo_id)
        except Photo.DoesNotExist:
            logger.info('thumbnail_worker_photo_missing', extra={'photoId': photo_id})
            return False

        if storage_key != photo.storage_key:
            logger.warning(
                'thumbnail_worker_storage_key_mismatch',
                extra={'photoId': photo_id, 'eventStorageKey': storage_key, 'photoStorageKey': photo.storage_key},
            )
            return False

        if photo.thumbnail_url:
            # Already generated (duplicate delivery, manual reprocess, etc.).
            # Kafka at-least-once semantics make this the common case on retry.
            logger.debug('thumbnail_worker_already_populated', extra={'photoId': photo_id})
            return True

        thumbnail_url = self.storage_service.generate_thumbnail_for_storage_key(photo.storage_key)
        photo.thumbnail_url = thumbnail_url
        photo.save(update_fields=['thumbnail_url'])

        self.producer.publish(
            THUMBNAIL_READY_TOPIC,
            {
                'photoId': photo_id,
                'spotId': str(photo.spot_id),
                'thumbnailUrl': thumbnail_url,
            },
        )
        logger.info(
            'thumbnail_worker_processed',
            extra={'photoId': photo_id, 'storageKey': photo.storage_key},
        )
        return True

    def _process_records(self, consumer: Any, records: dict) -> bool:
        """Process one Kafka poll batch.

        Returns True when it is safe to commit the consumer position. A
        retryable handler failure seeks back to the failed offset and returns
        False so at-least-once delivery is preserved in the same process.
        """
        for partition, batch in records.items():
            for record in batch:
                key = self._record_key(record)
                try:
                    ok = self.handle_payload(record.value)
                    record_kafka_consumed(
                        record.topic,
                        self.consumer_group,
                        status='ok' if ok else 'skipped',
                    )
                    self._attempt_counts.pop(key, None)
                except Exception as exc:
                    attempts = self._attempt_counts.get(key, 0) + 1
                    self._attempt_counts[key] = attempts
                    logger.exception(
                        'thumbnail_worker_handler_error',
                        extra={
                            'offset': record.offset,
                            'partition': record.partition,
                            'attempts': attempts,
                        },
                    )
                    record_kafka_consumed(record.topic, self.consumer_group, status='error')
                    if attempts >= MAX_EVENT_ATTEMPTS:
                        self._publish_dead_letter(record, exc)
                        self._attempt_counts.pop(key, None)
                        continue

                    try:
                        consumer.seek(partition, record.offset)
                    except Exception:  # pragma: no cover - seek failures are rare
                        logger.debug(
                            'thumbnail_worker_retry_seek_failed',
                            extra={'partition': record.partition, 'offset': record.offset},
                            exc_info=True,
                        )
                    return False

            try:
                highwater = consumer.highwater(partition)
                position = consumer.position(partition)
                if highwater is not None and position is not None:
                    record_kafka_consumer_lag(
                        partition.topic,
                        partition.partition,
                        self.consumer_group,
                        highwater - position,
                    )
            except Exception:  # pragma: no cover - metric is best-effort
                logger.debug(
                    'thumbnail_worker_lag_metric_failed',
                    extra={'partition': getattr(partition, 'partition', None)},
                    exc_info=True,
                )

        return True

    def run_forever(self, *, poll_timeout_ms: int = 1000, idle_sleep_seconds: float = 0.1) -> None:
        """Main consumer loop. Lazy-imports `kafka` so test environments
        without the broker package can still import this module.
        """
        if not settings.KAFKA_ENABLED:
            logger.warning('thumbnail_worker_kafka_disabled_exiting')
            return

        from kafka import (
            KafkaConsumer,  # local import keeps module importable w/o kafka
        )

        signal.signal(signal.SIGTERM, self.request_shutdown)
        signal.signal(signal.SIGINT, self.request_shutdown)

        consumer = KafkaConsumer(
            THUMBNAIL_REQUESTED_TOPIC,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
            value_deserializer=lambda value: json.loads(value.decode('utf-8')),
            auto_offset_reset='earliest',
            # Manual commit lets us avoid losing work on unclean shutdown; we
            # commit only after handle_payload returns. Upstream producer is
            # idempotent enough that duplicates are safe.
            enable_auto_commit=False,
            group_id=self.consumer_group,
            max_poll_records=int(os.getenv('SCOPE_THUMBNAIL_WORKER_MAX_POLL', '10')),
        )

        logger.info('thumbnail_worker_started', extra={'group': self.consumer_group})
        try:
            while not self._shutdown:
                records = consumer.poll(timeout_ms=poll_timeout_ms)
                if not records:
                    time.sleep(idle_sleep_seconds)
                    continue
                    # After processing a partition batch, emit the lag gauge.
                    # `highwater()` is cached on the consumer (no broker round
                    # trip), and `position()` is read locally too — so this is
                    # cheap enough to run every poll. The diff is the single
                    # most useful signal for "should I scale out the worker?".
                if self._process_records(consumer, records):
                    consumer.commit()
        finally:
            try:
                consumer.close()
            except Exception:  # pragma: no cover - best effort on shutdown
                logger.debug('thumbnail_worker_consumer_close_failed', exc_info=True)
            try:
                self.producer.flush()
            except Exception:  # pragma: no cover
                logger.debug('thumbnail_worker_producer_flush_failed', exc_info=True)
            logger.info('thumbnail_worker_stopped')


def run() -> None:
    """Entry point used by the `scope_thumbnail_worker` management command."""
    ThumbnailWorker().run_forever()
