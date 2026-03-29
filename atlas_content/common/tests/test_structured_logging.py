from __future__ import annotations

import io
import json
import logging
from collections import namedtuple
from contextlib import contextmanager
from uuid import uuid4

import jwt
import pytest
from django.conf import settings
from django.test import override_settings
from rest_framework.test import APIClient

from common.kafka_consumer import AtlasKafkaConsumer
from common.logging_utils import AtlasContextFilter, AtlasJsonFormatter

FakePartition = namedtuple('FakePartition', ['topic'])
pytestmark = pytest.mark.django_db


@contextmanager
def capture_json_logs(logger_name: str):
    logger = logging.getLogger(logger_name)
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(AtlasContextFilter())
    handler.setFormatter(AtlasJsonFormatter('%(message)s'))

    previous_handlers = logger.handlers[:]
    previous_level = logger.level
    previous_propagate = logger.propagate

    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    try:
        yield stream
    finally:
        logger.handlers = previous_handlers
        logger.setLevel(previous_level)
        logger.propagate = previous_propagate



def parse_json_logs(stream: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]



def auth_client_with_correlation(user_id: str, correlation_id: str) -> APIClient:
    client = APIClient()
    token = jwt.encode(
        {
            'sub': user_id,
            'email': f'{user_id}@example.com',
            'name': 'Logging Tester',
            'roles': ['user'],
            'iss': settings.JWT_ISSUER,
            'aud': settings.JWT_AUDIENCE,
            'exp': 4102444800,
        },
        settings.JWT_SECRET,
        algorithm='HS256',
    )
    client.credentials(
        HTTP_AUTHORIZATION=f'Bearer {token}',
        HTTP_X_CORRELATION_ID=correlation_id,
    )
    return client



def test_request_logging_emits_structured_json_with_correlation_id(api_client):
    correlation_id = 'req-logging-123'

    with capture_json_logs('common.middleware.request_logging') as stream:
        response = api_client.get('/api/content/health', HTTP_X_CORRELATION_ID=correlation_id)

    logs = parse_json_logs(stream)

    assert response.status_code == 200
    assert len(logs) == 1
    request_log = logs[0]
    assert request_log['message'] == 'request_completed'
    assert request_log['service'] == 'content'
    assert request_log['level'] == 'INFO'
    assert request_log['correlationId'] == correlation_id
    assert request_log['method'] == 'GET'
    assert request_log['path'] == '/api/content/health'
    assert request_log['statusCode'] == 200
    assert request_log['durationMs'] >= 0
    assert request_log['logger'] == 'common.middleware.request_logging'



def test_kafka_producer_log_inherits_request_correlation_id(auth_header, spot):
    _, owner_user_id = auth_header
    correlation_id = 'spot-like-correlation'
    client = auth_client_with_correlation(owner_user_id, correlation_id)

    with capture_json_logs('common.kafka_producer') as stream:
        response = client.post(f'/api/content/spots/{spot.id}/like')

    logs = parse_json_logs(stream)

    assert response.status_code == 201
    assert len(logs) == 1
    producer_log = logs[0]
    assert producer_log['message'] == 'kafka_event_produced'
    assert producer_log['service'] == 'content'
    assert producer_log['correlationId'] == correlation_id
    assert producer_log['topic'] == 'spot.liked'
    assert producer_log['eventType'] == 'spot.liked'
    assert producer_log['eventId']


@override_settings(KAFKA_ENABLED=True, KAFKA_BOOTSTRAP_SERVERS='broker-a:9092')
def test_kafka_consumer_log_uses_system_correlation_id_outside_request(monkeypatch):
    class FakeKafkaConsumer:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def poll(self, timeout_ms: int):
            return {
                FakePartition('friend.accepted'): [{'value': {'userId': '123'}}, {'value': {'userId': '456'}}],
            }

    monkeypatch.setattr('common.kafka_consumer.KafkaConsumer', FakeKafkaConsumer)

    with capture_json_logs('common.kafka_consumer') as stream:
        consumer = AtlasKafkaConsumer()
        records = consumer.poll_once()

    logs = parse_json_logs(stream)

    assert records
    assert len(logs) == 1
    consumer_log = logs[0]
    assert consumer_log['message'] == 'kafka_event_consumed'
    assert consumer_log['service'] == 'content'
    assert consumer_log['correlationId'] == 'system'
    assert consumer_log['topic'] == 'friend.accepted'
    assert consumer_log['recordCount'] == 2
