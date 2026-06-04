"""Search API views powered by Elasticsearch."""

from __future__ import annotations

import logging

from django.http import JsonResponse
from rest_framework.views import APIView

from common.search import REVIEW_INDEX, SPOT_INDEX, TRIP_INDEX, get_es_client

logger = logging.getLogger(__name__)


def _bounded_int(value: str | None, default: int, maximum: int) -> int:
    try:
        parsed = int(value if value is not None else default)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, 0), maximum)


def _visibility_filter_for(doc_type: str) -> dict:
    if doc_type == 'reviews':
        return {'term': {'spot_is_public': True}}

    return {'term': {'is_public': True}}


def _is_visible_search_hit(doc_type: str, entry: dict) -> bool:
    if doc_type == 'reviews':
        return entry.get('spot_is_public') is True

    return entry.get('is_public') is True


class SearchView(APIView):
    """Full-text search across spots, reviews, and trips."""

    def get(self, request):
        q = request.GET.get('q', '').strip()
        doc_type = request.GET.get('type', 'spots')
        limit = _bounded_int(request.GET.get('limit'), 20, 100)
        offset = _bounded_int(request.GET.get('offset'), 0, 10_000)

        if not q:
            return JsonResponse({'error': "Query parameter 'q' is required"}, status=400)

        index_map = {'spots': SPOT_INDEX, 'reviews': REVIEW_INDEX, 'trips': TRIP_INDEX}
        index = index_map.get(doc_type)
        if index is None:
            return JsonResponse({'error': f'Invalid type: {doc_type}. Use spots, reviews, or trips.'}, status=400)

        client = get_es_client()
        if client is None:
            return JsonResponse({'error': 'Search service unavailable'}, status=503)

        body = {
            'query': {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': q,
                                'fields': self._fields_for(doc_type),
                                'fuzziness': 'AUTO',
                                'type': 'best_fields',
                            }
                        }
                    ],
                    'filter': [_visibility_filter_for(doc_type)],
                }
            },
            'from': offset,
            'size': limit,
            'highlight': {
                'fields': {'name': {}, 'text': {}, 'description': {}},
                'pre_tags': ['<em>'],
                'post_tags': ['</em>'],
            },
        }

        try:
            result = client.search(index=index, body=body)
        except Exception:
            logger.exception('Elasticsearch query failed')
            return JsonResponse({'error': 'Search query failed'}, status=500)

        hits = []
        for hit in result['hits']['hits']:
            entry = hit['_source']
            if not _is_visible_search_hit(doc_type, entry):
                continue
            entry['_score'] = hit['_score']
            entry['_highlights'] = hit.get('highlight', {})
            hits.append(entry)

        return JsonResponse(
            {
                'query': q,
                'type': doc_type,
                'total': len(hits),
                'offset': offset,
                'limit': limit,
                'results': hits,
            }
        )

    @staticmethod
    def _fields_for(doc_type: str) -> list[str]:
        if doc_type == 'spots':
            return ['name^3', 'description', 'tags^2', 'category^2']
        if doc_type == 'reviews':
            return ['text']
        if doc_type == 'trips':
            return ['name^3', 'description']
        return ['name', 'description', 'text']


class GeoSearchView(APIView):
    """Geo-radius search for spots."""

    def get(self, request):
        try:
            lat = float(request.GET.get('lat', 0))
            lon = float(request.GET.get('lon', 0))
        except (TypeError, ValueError):
            return JsonResponse({'error': 'lat and lon must be valid numbers'}, status=400)

        radius = request.GET.get('radius', '10km')
        limit = _bounded_int(request.GET.get('limit'), 20, 100)

        client = get_es_client()
        if client is None:
            return JsonResponse({'error': 'Search service unavailable'}, status=503)

        body = {
            'query': {
                'bool': {
                    'filter': [
                        {
                            'geo_distance': {
                                'distance': radius,
                                'location': {'lat': lat, 'lon': lon},
                            }
                        },
                        {'term': {'is_public': True}},
                    ]
                }
            },
            'sort': [
                {
                    '_geo_distance': {
                        'location': {'lat': lat, 'lon': lon},
                        'order': 'asc',
                        'unit': 'km',
                    }
                }
            ],
            'size': limit,
        }

        try:
            result = client.search(index=SPOT_INDEX, body=body)
        except Exception:
            logger.exception('Geo search failed')
            return JsonResponse({'error': 'Geo search failed'}, status=500)

        hits = []
        for hit in result['hits']['hits']:
            entry = hit['_source']
            if not _is_visible_search_hit('spots', entry):
                continue
            entry['_distance_km'] = hit['sort'][0] if hit.get('sort') else None
            hits.append(entry)

        return JsonResponse(
            {
                'center': {'lat': lat, 'lon': lon},
                'radius': radius,
                'total': len(hits),
                'results': hits,
            }
        )
