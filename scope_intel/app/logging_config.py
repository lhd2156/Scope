from __future__ import annotations

import logging
from datetime import datetime, timezone

from flask import Flask, g, has_request_context
from pythonjsonlogger.json import JsonFormatter

from app.config import settings


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "service"):
            record.service = settings.service_name
        if not hasattr(record, "correlation_id"):
            record.correlation_id = getattr(g, "trace_id", None) if has_request_context() else None
        return True


class ScopeJsonFormatter(JsonFormatter):
    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        log_record["service"] = getattr(record, "service", settings.service_name)
        log_record["level"] = record.levelname
        log_record["message"] = record.getMessage()
        log_record["correlation_id"] = getattr(record, "correlation_id", None)


SERVICE_LOGGER_NAME = "app"


def configure_logging(app: Flask) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(ScopeJsonFormatter())
    handler.addFilter(RequestContextFilter())

    service_logger = logging.getLogger(SERVICE_LOGGER_NAME)
    service_logger.handlers.clear()
    service_logger.addHandler(handler)
    service_logger.setLevel(logging.INFO)
    service_logger.propagate = False

    app.logger.handlers.clear()
    app.logger.setLevel(logging.INFO)
    app.logger.propagate = True
