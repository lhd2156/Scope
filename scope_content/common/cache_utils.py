from __future__ import annotations

import json
from collections.abc import Callable
from hashlib import sha256

from django.core.cache import cache
from rest_framework.response import Response

SPOTS_CACHE_NAMESPACE = 'spots'
FEED_CACHE_NAMESPACE = 'feed'
CACHE_VERSION_PREFIX = 'content:cache-version'
CACHE_VERSION_DEFAULT = 1
ANONYMOUS_CACHE_USER = 'anon'


ResponseBuilder = Callable[[], Response]


def _query_signature(query_params) -> list[tuple[str, list[str]]]:
    return [(key, query_params.getlist(key)) for key in sorted(query_params.keys())]



def _request_user_signature(request) -> str:
    user = getattr(request, 'user', None)
    if getattr(user, 'is_authenticated', False):
        return str(getattr(user, 'id', ANONYMOUS_CACHE_USER))
    return ANONYMOUS_CACHE_USER



def _namespace_version_key(namespace: str) -> str:
    return f'{CACHE_VERSION_PREFIX}:{namespace}'



def cache_namespace_version(namespace: str) -> int:
    return int(cache.get(_namespace_version_key(namespace), CACHE_VERSION_DEFAULT))



def cache_key(namespace: str, request, extra: str | None = None) -> str:
    payload = {
        'namespace': namespace,
        'version': cache_namespace_version(namespace),
        'path': request.path,
        'query': _query_signature(request.query_params),
        'user': _request_user_signature(request),
        'extra': extra,
    }
    digest = sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str).encode('utf-8')).hexdigest()
    return f'content:{namespace}:{digest}'



def cached_api_response(request, namespace: str, timeout: int, builder: ResponseBuilder, extra: str | None = None) -> Response:
    key = cache_key(namespace, request, extra=extra)
    cached_payload = cache.get(key)
    if cached_payload is not None:
        return Response(cached_payload['body'], status=cached_payload['status'])

    response = builder()
    if hasattr(response, 'data') and 200 <= response.status_code < 300:
        cache.set(key, {'status': response.status_code, 'body': response.data}, timeout=timeout)
    return response



def invalidate_cache_namespaces(*namespaces: str) -> None:
    for namespace in namespaces:
        key = _namespace_version_key(namespace)
        current_version = cache.get(key, CACHE_VERSION_DEFAULT)
        try:
            cache.set(key, int(current_version) + 1, None)
        except (TypeError, ValueError):
            cache.set(key, CACHE_VERSION_DEFAULT + 1, None)
