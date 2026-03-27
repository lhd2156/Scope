import json
import logging
from django.conf import settings
from kafka import KafkaConsumer
logger = logging.getLogger(__name__)
class AtlasKafkaConsumer:
    topics = ['friend.accepted', 'user.updated']
    def __init__(self):
        self.consumer = None
        if settings.KAFKA_ENABLED:
            self.consumer = KafkaConsumer(*self.topics, bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','), value_deserializer=lambda value: json.loads(value.decode('utf-8')), auto_offset_reset='earliest', group_id='atlas-content')
    def poll_once(self):
        if not self.consumer:
            return []
        records = self.consumer.poll(timeout_ms=1000)
        logger.info('kafka_event_consumed', extra={'records': len(records)})
        return records
