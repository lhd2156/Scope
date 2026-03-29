from __future__ import annotations

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response


def _format_error(code: str, message: str, details=None, trace_id=None):
    return {'error': {'code': code, 'message': message, 'details': details or [], 'traceId': trace_id}}


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

    if isinstance(exc, ValidationError):
        details = []
        if isinstance(exc.detail, dict):
            for field, messages in exc.detail.items():
                if not isinstance(messages, list):
                    messages = [messages]
                for message in messages:
                    details.append({'field': field, 'message': str(message)})
        return Response(_format_error('VALIDATION_ERROR', 'Invalid input data', details=details, trace_id=trace_id), status=400)

    return Response(_format_error('INTERNAL_ERROR', 'Unexpected server error', trace_id=trace_id), status=500)
