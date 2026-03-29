from __future__ import annotations

import logging
from contextvars import ContextVar, Token
from datetime import datetime, timezone

from pythonjsonlogger.json import JsonFormatter

SERVICE_NAME = 'content'
SYSTEM_CORRELATION_ID = 'system'
OPTIONAL_RECORD_FIELDS = {
    'method': 'method',
    'path': 'path',
    'status_code': 'statusCode',
    'duration_ms': 'durationMs',
    'topic': 'topic',
    'event_type': 'eventType',
    'event_id': 'eventId',
    'record_count': 'recordCount',
    'content_type': 'contentType',
    'content_length': 'contentLength',
}

_correlation_id_context: ContextVar[str] = ContextVar('correlation_id', default=SYSTEM_CORRELATION_ID)


def get_correlation_id() -> str:
    return _correlation_id_context.get()


def set_correlation_id(value: str) -> Token[str]:
    return _correlation_id_context.set(value or SYSTEM_CORRELATION_ID)


def reset_correlation_id(token: Token[str]) -> None:
    _correlation_id_context.reset(token)


class AtlasContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.service = getattr(record, 'service', None) or SERVICE_NAME
        record.correlation_id = getattr(record, 'correlation_id', None) or get_correlation_id()
        for field_name in OPTIONAL_RECORD_FIELDS:
            if not hasattr(record, field_name):
                setattr(record, field_name, None)
        return True


class AtlasJsonFormatter(JsonFormatter):
    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record['timestamp'] = datetime.now(timezone.utc).isoformat()
        log_record['service'] = getattr(record, 'service', SERVICE_NAME)
        log_record['level'] = record.levelname
        log_record['message'] = record.getMessage()
        log_record['correlationId'] = getattr(record, 'correlation_id', get_correlation_id())
        log_record['logger'] = record.name

        for record_field, output_field in OPTIONAL_RECORD_FIELDS.items():
            value = getattr(record, record_field, None)
            if value is not None:
                log_record[output_field] = value

    def process_log_record(self, log_record: dict) -> dict:
        cleaned = {key: value for key, value in log_record.items() if value is not None}
        for redundant_key in (
            'asctime',
            'levelname',
            'correlation_id',
            'taskName',
            'msg',
            'status_code',
            'duration_ms',
            'content_type',
            'content_length',
            'event_type',
            'event_id',
            'record_count',
        ):
            cleaned.pop(redundant_key, None)
        return cleaned
