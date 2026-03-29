from __future__ import annotations

from dataclasses import dataclass

from rest_framework.decorators import api_view, permission_classes

from common.pagination import FeedCursorPagination
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from feed.services.feed_aggregator import FeedAggregator
from spots.serializers import SpotSerializer
from trips.serializers import TripSerializer


@dataclass(slots=True)
class FeedEntry:
    type: str
    created_at: object
    item: object


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def social_feed(request):
    items = FeedAggregator().social_feed_queryset(getattr(getattr(request, 'user', None), 'id', None))
    normalized: list[FeedEntry] = []
    for item in sorted(items, key=lambda current: current.created_at, reverse=True):
        if item.__class__.__name__ == 'Spot':
            normalized.append(FeedEntry(type='spot', created_at=item.created_at, item=item))
        else:
            normalized.append(FeedEntry(type='trip', created_at=item.created_at, item=item))

    paginator = FeedCursorPagination()
    page = paginator.paginate_queryset(normalized, request)
    serialized_page = [
        {
            'type': entry.type,
            'created_at': entry.created_at,
            'item': SpotSerializer(entry.item).data if entry.type == 'spot' else TripSerializer(entry.item).data,
        }
        for entry in page
    ]
    return paginator.get_paginated_response(serialized_page)


@api_view(['GET'])
def trending_spots(request):
    spots = FeedAggregator().trending_spots_queryset()[:20]
    return data_response(SpotSerializer(spots, many=True).data)
