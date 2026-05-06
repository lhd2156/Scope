from __future__ import annotations

import json
import logging
import os
import socket
import uuid
from datetime import datetime, timezone

from django.conf import settings
from kafka import KafkaProducer

from common.telemetry import record_kafka_produced

logger = logging.getLogger(__name__)


class ScopeKafkaProducer:
    """Kafka producer configured for durability and safe replay at scale.

    Defaults tuned for:
    - ``acks='all'``: broker-side durability; leader waits for all in-sync
      replicas before ack. Prevents event loss on leader failover.
    - ``max_in_flight_requests_per_connection=1`` + ``retries``: preserves
      per-partition order under retries (kafka-python has no native idempotent
      producer, so we rely on ordering + consumer-side dedup on ``eventId``).
    - ``request_timeout_ms``: retry on transient network / leader election
      rather than drop the event.
    - ``compression_type='gzip'``: shrinks batched JSON ~5-10x; at high fanout
      this is the difference between saturating an NLB and not.
    - ``linger_ms``: small batching window so bursty writes cost 1 network
      round-trip instead of N.
    - ``client_id``: per-host tag so broker-side metrics and topic authorization
      can distinguish replicas.
    """

    def __init__(self):
        self._producer = None
        if settings.KAFKA_ENABLED:
            self._producer = KafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_serializer=lambda value: json.dumps(value).encode('utf-8'),
                client_id=os.getenv('KAFKA_CLIENT_ID', f'scope-content-{socket.gethostname()}'),
                acks='all',
                retries=int(os.getenv('KAFKA_PRODUCER_RETRIES', '5')),
                # max_in_flight=1 is the kafka-python way to prevent retry-induced
                # reordering on a partition. Consumers dedupe on `eventId` for
                # at-most-once semantics when idempotence matters.
                max_in_flight_requests_per_connection=int(
                    os.getenv('KAFKA_MAX_IN_FLIGHT', '1')
                ),
                request_timeout_ms=int(os.getenv('KAFKA_REQUEST_TIMEOUT_MS', '30000')),
                compression_type=os.getenv('KAFKA_COMPRESSION', 'gzip'),
                linger_ms=int(os.getenv('KAFKA_LINGER_MS', '10')),
                batch_size=int(os.getenv('KAFKA_BATCH_SIZE', '32768')),
            )

    def publish(self, topic: str, data: dict):
        event = {
            'eventId': str(uuid.uuid4()),
            'eventType': topic,
            'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'source': 'content-engine',
            'data': data,
        }
        logger.info(
            'kafka_event_produced',
            extra={
                'topic': topic,
                'event_type': event['eventType'],
                'event_id': event['eventId'],
            },
        )
        if self._producer:
            # Send asynchronously but attach callbacks so outcomes hit the log
            # AND the prometheus counters rather than disappearing into an
            # orphaned Future. For write endpoints that require durability
            # guarantees the caller should invoke `flush()` explicitly before
            # returning 2xx.
            future = self._producer.send(topic, event)
            if future is not None and hasattr(future, 'add_errback'):
                # Count enqueues optimistically and correct on error in the
                # errback. That way the ok counter stays fast-path (no callback
                # on the hot path when things are healthy) and the error counter
                # still reflects reality. Net result: produced_total{status="ok"}
                # == attempts, produced_total{status="error"} == errbacks. The
                # dashboard's error_ratio panel subtracts to get success count.
                record_kafka_produced(topic, status='ok')
                future.add_errback(
                    lambda exc, evt=event: (
                        logger.error(
                            'kafka_event_send_failed',
                            extra={
                                'topic': topic,
                                'event_type': evt['eventType'],
                                'event_id': evt['eventId'],
                                'error': str(exc),
                            },
                        ),
                        record_kafka_produced(topic, status='error'),
                    )
                )
            else:
                # Synchronous path / test stubs without Future: count once.
                record_kafka_produced(topic, status='ok')

    def flush(self, timeout: float | None = None):
        """Block until all buffered messages are delivered or timeout expires.

        Call this from critical write paths (e.g. account creation) when the
        caller must not receive a 2xx unless the event is durably on a broker.
        """
        if self._producer:
            self._producer.flush(timeout=timeout)
