from __future__ import annotations

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes

from common.cache_utils import FEED_CACHE_NAMESPACE, cached_api_response
from common.pagination import FeedCursorPagination
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from feed.services.feed_aggregator import FeedAggregator
from spots.serializers import SpotSerializer
from trips.serializers import TripSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def social_feed(request):
    def build_response():
        paginator = FeedCursorPagination()
        cursor = paginator.parse_cursor(request)
        page = FeedAggregator().social_feed_page(
            cursor=cursor,
            user_id=getattr(getattr(request, 'user', None), 'id', None),
            page_size=paginator.page_size,
        )
        paginator.set_page_state(page.entries, page.has_more)
        serialized_page = [
            {
                'type': entry.type,
                'created_at': entry.created_at,
                'item': SpotSerializer(entry.item).data if entry.type == 'spot' else TripSerializer(entry.item).data,
            }
            for entry in page.entries
        ]
        return paginator.get_paginated_response(serialized_page)

    return cached_api_response(
        request,
        FEED_CACHE_NAMESPACE,
        settings.CACHE_FEED_TIMEOUT_SECONDS,
        build_response,
        extra='feed-social',
    )


@api_view(['GET'])
def trending_spots(request):
    def build_response():
        spots = FeedAggregator().trending_spots_queryset()[:20]
        return data_response(SpotSerializer(spots, many=True).data)

    return cached_api_response(
        request,
        FEED_CACHE_NAMESPACE,
        settings.CACHE_FEED_TIMEOUT_SECONDS,
        build_response,
        extra='feed-trending',
    )
