from rest_framework.decorators import api_view
from common.pagination import FeedCursorPagination
from common.responses import data_response
from feed.services.feed_aggregator import FeedAggregator
from spots.serializers import SpotSerializer
from trips.serializers import TripSerializer
@api_view(['GET'])
def social_feed(request):
    items = FeedAggregator().social_feed_queryset(getattr(getattr(request, 'user', None), 'id', None))
    normalized = []
    for item in sorted(items, key=lambda current: current.created_at, reverse=True):
        if item.__class__.__name__ == 'Spot':
            normalized.append({'type': 'spot', 'created_at': item.created_at, 'item': SpotSerializer(item).data})
        else:
            normalized.append({'type': 'trip', 'created_at': item.created_at, 'item': TripSerializer(item).data})
    paginator = FeedCursorPagination()
    page = paginator.paginate_queryset(normalized, request)
    return paginator.get_paginated_response(page)
@api_view(['GET'])
def trending_spots(request):
    spots = FeedAggregator().trending_spots_queryset()[:20]
    return data_response(SpotSerializer(spots, many=True).data)
