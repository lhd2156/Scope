from __future__ import annotations

import importlib
from types import SimpleNamespace

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.test import override_settings
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, ParseError, PermissionDenied, ValidationError

from common.exceptions import custom_exception_handler
from common.kafka_consumer import AtlasKafkaConsumer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response


@pytest.mark.django_db
def test_asgi_and_wsgi_modules_expose_applications():
    asgi_module = importlib.reload(importlib.import_module('atlas_content.asgi'))
    wsgi_module = importlib.reload(importlib.import_module('atlas_content.wsgi'))

    assert callable(asgi_module.application)
    assert callable(wsgi_module.application)


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=False)
def test_kafka_consumer_returns_empty_records_when_disabled():
    consumer = AtlasKafkaConsumer()

    assert consumer.consumer is None
    assert consumer.poll_once() == []


@pytest.mark.django_db
@override_settings(KAFKA_ENABLED=True, KAFKA_BOOTSTRAP_SERVERS='broker-a:9092,broker-b:9092')
def test_kafka_consumer_initializes_and_polls_records(monkeypatch):
    captured: dict[str, object] = {}

    class FakeKafkaConsumer:
        def __init__(self, *args, **kwargs):
            captured['args'] = args
            captured['kwargs'] = kwargs

        def poll(self, timeout_ms: int):
            captured['timeout_ms'] = timeout_ms
            return {'friend.accepted': [{'value': {'userId': 'abc'}}]}

    monkeypatch.setattr('common.kafka_consumer.KafkaConsumer', FakeKafkaConsumer)

    consumer = AtlasKafkaConsumer()
    records = consumer.poll_once()
    deserializer = captured['kwargs']['value_deserializer']

    assert captured['args'] == ('friend.accepted', 'user.updated')
    assert captured['kwargs']['bootstrap_servers'] == ['broker-a:9092', 'broker-b:9092']
    assert captured['kwargs']['auto_offset_reset'] == 'earliest'
    assert captured['kwargs']['group_id'] == 'atlas-content'
    assert deserializer(b'{"event":"ok"}') == {'event': 'ok'}
    assert captured['timeout_ms'] == 1000
    assert records == {'friend.accepted': [{'value': {'userId': 'abc'}}]}


@pytest.mark.django_db
def test_is_authenticated_jwt_permission_checks_request_user():
    permission = IsAuthenticatedJWT()
    authenticated_request = SimpleNamespace(user=SimpleNamespace(is_authenticated=True))
    anonymous_request = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
    missing_user_request = SimpleNamespace()

    assert permission.has_permission(authenticated_request, None) is True
    assert permission.has_permission(anonymous_request, None) is False
    assert permission.has_permission(missing_user_request, None) is False


@pytest.mark.django_db
def test_data_response_wraps_payload_and_optional_meta():
    with_meta = data_response({'spotId': '123'}, status_code=201, meta={'page': 1})
    without_meta = data_response(['a', 'b'])

    assert with_meta.status_code == 201
    assert with_meta.data == {'data': {'spotId': '123'}, 'meta': {'page': 1}}
    assert without_meta.status_code == 200
    assert without_meta.data == {'data': ['a', 'b']}


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('exc', 'status_code', 'error_code', 'message'),
    [
        (Http404(), 404, 'NOT_FOUND', 'Resource does not exist'),
        (PermissionDenied(), 403, 'FORBIDDEN', 'Insufficient permissions'),
        (NotAuthenticated(), 401, 'UNAUTHORIZED', 'Missing or expired token'),
        (AuthenticationFailed(), 401, 'UNAUTHORIZED', 'Invalid token'),
        (ParseError('Malformed JSON'), 400, 'VALIDATION_ERROR', 'Invalid input data'),
        (ValueError('boom'), 500, 'INTERNAL_ERROR', 'Unexpected server error'),
    ],
)
def test_custom_exception_handler_maps_common_errors(exc, status_code, error_code, message):
    request = SimpleNamespace(correlation_id='trace-123')

    response = custom_exception_handler(exc, {'request': request})

    assert response.status_code == status_code
    assert response.data['error']['code'] == error_code
    assert response.data['error']['message'] == message
    assert response.data['error']['traceId'] == 'trace-123'


@pytest.mark.django_db
def test_custom_exception_handler_flattens_validation_errors():
    request = SimpleNamespace(correlation_id='trace-456')
    exc = ValidationError({'title': ['Required field'], 'rating': 'Out of range'})

    response = custom_exception_handler(exc, {'request': request})

    assert response.status_code == 400
    assert response.data['error']['code'] == 'VALIDATION_ERROR'
    assert response.data['error']['traceId'] == 'trace-456'
    assert {'field': 'title', 'message': 'Required field'} in response.data['error']['details']
    assert {'field': 'rating', 'message': 'Out of range'} in response.data['error']['details']


@pytest.mark.django_db
def test_custom_exception_handler_flattens_non_field_error_lists():
    request = SimpleNamespace(correlation_id='trace-789')
    exc = ValidationError(['General failure'])

    response = custom_exception_handler(exc, {'request': request})

    assert response.status_code == 400
    assert response.data['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'non_field_errors', 'message': 'General failure'} in response.data['error']['details']


@pytest.mark.django_db
def test_custom_exception_handler_supports_django_validation_errors():
    request = SimpleNamespace(correlation_id='trace-999')
    exc = DjangoValidationError({'title': ['Required from Django']})

    response = custom_exception_handler(exc, {'request': request})

    assert response.status_code == 400
    assert response.data['error']['code'] == 'VALIDATION_ERROR'
    assert {'field': 'title', 'message': 'Required from Django'} in response.data['error']['details']
