"""Process entrypoint for the Intel Kafka consumer worker."""

from __future__ import annotations

import logging
import os
import signal
from types import FrameType

from app.factory import create_app
from app.kafka.consumer import KafkaSpotFeatureConsumer

logger = logging.getLogger(__name__)


def main() -> None:
    """Boot Flask once so SQLAlchemy/config/logging are initialized, then poll Kafka."""
    os.environ.setdefault("GRPC_ENABLED", "false")
    os.environ.setdefault("INTEL_WARMUP_RECOMMENDATIONS", "false")

    app = create_app()
    consumer = KafkaSpotFeatureConsumer()

    def request_shutdown(_signum: int, _frame: FrameType | None) -> None:
        logger.info("intel_kafka_worker_shutdown_requested")
        consumer.stop()

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    with app.app_context():
        logger.info("intel_kafka_worker_starting")
        consumer.run_forever()


if __name__ == "__main__":
    main()
