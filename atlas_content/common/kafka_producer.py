import json
import logging
import uuid
from datetime import datetime, timezone
from django.conf import settings
from kafka import KafkaProducer
logger = logging.getLogger(__name__)
class AtlasKafkaProducer:
    def __init__(self):
        self._producer = None
        if settings.KAFKA_ENABLED:
            self._producer = KafkaProducer(bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','), value_serializer=lambda value: json.dumps(value).encode('utf-8'))
    def publish(self, topic: str, data: dict):
        event = {'eventId': str(uuid.uuid4()), 'eventType': topic, 'timestamp': datetime.now(timezone.utc).isoformat(), 'service': 'content', 'data': data}
        logger.info('kafka_event_produced', extra={'topic': topic})
        if self._producer:
            self._producer.send(topic, event)
