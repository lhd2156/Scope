import json
import logging

from confluent_kafka import Producer

from config import settings

logger = logging.getLogger(__name__)


class KafkaEventProducer:
    def __init__(self) -> None:
        self._producer = Producer({"bootstrap.servers": settings.kafka_bootstrap_servers})

    def publish(self, topic: str, payload: dict) -> None:
        encoded_payload = json.dumps(payload).encode("utf-8")
        self._producer.produce(topic, encoded_payload)
        self._producer.flush()
        logger.info(
            "kafka_event_produced",
            extra={
                "topic": topic,
                "event_direction": "produced",
                "payload_size_bytes": len(encoded_payload),
            },
        )
