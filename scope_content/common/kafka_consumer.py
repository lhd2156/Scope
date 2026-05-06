from __future__ import annotations

import json
import logging

from django.conf import settings
from kafka import KafkaConsumer

logger = logging.getLogger(__name__)


class ScopeKafkaConsumer:
    topics = ['friend.accepted', 'user.updated']

    def __init__(self):
        self.consumer = None
        if settings.KAFKA_ENABLED:
            self.consumer = KafkaConsumer(
                *self.topics,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_deserializer=lambda value: json.loads(value.decode('utf-8')),
                auto_offset_reset='earliest',
                group_id='scope-content',
            )

    def poll_once(self):
        if not self.consumer:
            return []

        records = self.consumer.poll(timeout_ms=1000)
        topics = sorted({getattr(partition, 'topic', str(partition)) for partition in records})
        logger.info(
            'kafka_event_consumed',
            extra={
                'topic': ','.join(topics) if topics else None,
                'record_count': sum(len(partition_records) for partition_records in records.values()),
            },
        )
        return records
