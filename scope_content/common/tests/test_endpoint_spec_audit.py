from __future__ import annotations

import re

import pytest
from django.urls import URLPattern, URLResolver, get_resolver

pytestmark = pytest.mark.django_db


def _flatten_routes(patterns, prefix: str = ''):
    for pattern in patterns:
        route = prefix + getattr(pattern.pattern, '_route', str(pattern.pattern))
        if isinstance(pattern, URLResolver):
            yield from _flatten_routes(pattern.url_patterns, route)
            continue
        if isinstance(pattern, URLPattern):
            yield route, pattern.callback



def _normalized_content_route(route: str) -> str:
    normalized = '/' + route.lstrip('/')
    return re.sub(r'<[^>]+>', '{}', normalized)



def _allowed_methods(callback) -> set[str]:
    view_cls = getattr(callback, 'cls', None)
    assert view_cls is not None, 'Expected DRF/Django callback to expose a view class'
    initkwargs = getattr(callback, 'initkwargs', {}) or {}
    view = view_cls(**initkwargs)
    return {method for method in view.allowed_methods if method != 'OPTIONS'}



def _content_route_contract() -> set[str]:
    contract: set[str] = set()
    for route, callback in _flatten_routes(get_resolver().url_patterns):
        normalized_route = _normalized_content_route(route)
        if not normalized_route.startswith('/api/content/'):
            continue
        for method in _allowed_methods(callback):
            contract.add(f'{method} {normalized_route}')
    return contract


EXPECTED_CONTENT_ROUTE_CONTRACT = {
    'GET /api/content/health',
    'GET /api/content/metrics',
    'GET /api/content/search',
    'GET /api/content/search/nearby',
    'DELETE /api/content/users/me',
    'GET /api/content/spots/',
    'POST /api/content/spots/',
    'POST /api/content/spots/compose',
    'GET /api/content/spots/{}',
    'PUT /api/content/spots/{}',
    'DELETE /api/content/spots/{}',
    'GET /api/content/spots/nearby',
    'GET /api/content/spots/saved',
    'GET /api/content/spots/user/{}',
    'GET /api/content/spots/explore',
    'POST /api/content/spots/{}/like',
    'DELETE /api/content/spots/{}/like',
    'GET /api/content/spots/{}/photos',
    'GET /api/content/trips/',
    'POST /api/content/trips/',
    'GET /api/content/trips/{}',
    'PUT /api/content/trips/{}',
    'DELETE /api/content/trips/{}',
    'GET /api/content/trips/share/{}',
    'POST /api/content/trips/{}/share',
    'POST /api/content/trips/{}/spots',
    'DELETE /api/content/trips/{}/spots/{}',
    'PUT /api/content/trips/{}/spots/reorder',
    'POST /api/content/trips/{}/members',
    'GET /api/content/trips/{}/members',
    'DELETE /api/content/trips/{}/members/{}',
    'GET /api/content/trips/public',
    'POST /api/content/photos/upload',
    'GET /api/content/photos/presigned-url',
    'POST /api/content/photos/avatar-upload',
    'GET /api/content/photos/avatar/content',
    'GET /api/content/photos/{}/content',
    'PUT /api/content/photos/{}',
    'DELETE /api/content/photos/{}',
    'POST /api/content/reviews/spot/{}',
    'GET /api/content/reviews/spot/{}',
    'PUT /api/content/reviews/{}',
    'DELETE /api/content/reviews/{}',
    'GET /api/content/feed/',
    'GET /api/content/feed/trending',
    'POST /api/content/interactions/',
    'GET /api/content/comments/',
    'POST /api/content/comments/',
    'PUT /api/content/comments/{}/',
    'DELETE /api/content/comments/{}/',
    'POST /api/content/comments/{}/replies/',
}



def test_content_route_surface_matches_architecture_contract():
    assert _content_route_contract() == EXPECTED_CONTENT_ROUTE_CONTRACT
