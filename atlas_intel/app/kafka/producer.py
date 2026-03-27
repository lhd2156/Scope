import json
from confluent_kafka import Producer
from config import settings

class KafkaEventProducer:
    def __init__(self) -> None:
        self._producer = Producer({"bootstrap.servers": settings.kafka_bootstrap_servers})

    def publish(self, topic: str, payload: dict) -> None:
        self._producer.produce(topic, json.dumps(payload).encode("utf-8"))
        self._producer.flush()
