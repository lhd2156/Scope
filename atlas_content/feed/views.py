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
    item: dict

    def to_response(self) -> dict:
        return {
            'type': self.type,
            'createdAt': self.created_at,
            'item': self.item,
        }


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def social_feed(request):
    items = FeedAggregator().social_feed_queryset(getattr(request.user, 'id', None))
    entries = []
    for item in sorted(items, key=lambda current: current.created_at, reverse=True):
        if item.__class__.__name__ == 'Spot':
            entries.append(FeedEntry(type='spot', created_at=item.created_at, item=SpotSerializer(item).data))
        else:
            entries.append(FeedEntry(type='trip', created_at=item.created_at, item=TripSerializer(item).data))

    paginator = FeedCursorPagination()
    page = paginator.paginate_queryset(entries, request)
    return paginator.get_paginated_response([entry.to_response() for entry in page])


@api_view(['GET'])
def trending_spots(request):
    try:
        limit = max(1, min(int(request.query_params.get('limit', 20)), 50))
    except ValueError:
        limit = 20

    spots = FeedAggregator().trending_spots_queryset()[:limit]
    return data_response(SpotSerializer(spots, many=True).data)
