from __future__ import annotations

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.settings import api_settings

try:
    import sentry_sdk
except ImportError:  # pragma: no cover - optional outside production/test envs
    sentry_sdk = None


def _format_error(code: str, message: str, details=None, trace_id=None):
    return {'error': {'code': code, 'message': message, 'details': details or [], 'traceId': trace_id}}


def _append_validation_detail(details: list[dict[str, str]], field: str | None, message) -> None:
    details.append({'field': field or api_settings.NON_FIELD_ERRORS_KEY, 'message': str(message)})


def _flatten_validation_detail(detail, details: list[dict[str, str]], field: str | None = None) -> None:
    if isinstance(detail, dict):
        for child_field, child_detail in detail.items():
            next_field = str(child_field) if not field else f'{field}.{child_field}'
            _flatten_validation_detail(child_detail, details, next_field)
        return

    if isinstance(detail, list):
        if not detail:
            _append_validation_detail(details, field, '')
            return

        if all(not isinstance(item, (dict, list)) for item in detail):
            for item in detail:
                _append_validation_detail(details, field, item)
            return

        for index, item in enumerate(detail):
            indexed_field = f'{field}[{index}]' if field else f'{api_settings.NON_FIELD_ERRORS_KEY}[{index}]'
            _flatten_validation_detail(item, details, indexed_field)
        return

    _append_validation_detail(details, field, detail)


def _extract_validation_details(exc: ValidationError | DjangoValidationError | ParseError) -> list[dict[str, str]]:
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            detail = exc.message_dict
        elif hasattr(exc, 'messages'):
            detail = exc.messages
        else:
            detail = str(exc)
    else:
        detail = getattr(exc, 'detail', str(exc))

    details: list[dict[str, str]] = []
    _flatten_validation_detail(detail, details)
    return details


def _capture_unhandled_exception(exc, request) -> None:
    if sentry_sdk is None:
        return

    trace_id = getattr(request, 'correlation_id', None)
    with sentry_sdk.new_scope() as scope:
        if trace_id:
            scope.set_tag('correlation_id', trace_id)
        if request is not None:
            scope.set_context(
                'request',
                {
                    'method': getattr(request, 'method', None),
                    'path': getattr(request, 'path', None),
                },
            )
        sentry_sdk.capture_exception(exc)


def custom_exception_handler(exc, context):
    request = context.get('request')
    trace_id = getattr(request, 'correlation_id', None)

    if isinstance(exc, (Http404, NotFound)):
        return Response(_format_error('NOT_FOUND', 'Resource does not exist', trace_id=trace_id), status=404)

    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return Response(_format_error('FORBIDDEN', 'Insufficient permissions', trace_id=trace_id), status=403)

    if isinstance(exc, NotAuthenticated):
        return Response(_format_error('UNAUTHORIZED', 'Missing or expired token', trace_id=trace_id), status=401)

    if isinstance(exc, AuthenticationFailed):
        return Response(_format_error('UNAUTHORIZED', 'Invalid token', trace_id=trace_id), status=401)

    if isinstance(exc, (ValidationError, DjangoValidationError, ParseError)):
        details = _extract_validation_details(exc)
        return Response(_format_error('VALIDATION_ERROR', 'Invalid input data', details=details, trace_id=trace_id), status=400)

    _capture_unhandled_exception(exc, request)
    return Response(_format_error('INTERNAL_ERROR', 'Unexpected server error', trace_id=trace_id), status=500)
