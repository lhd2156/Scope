from django.db.models import Avg, Count

from spots.models import Spot
from trips.models import Trip


class FeedAggregator:
    def social_feed_queryset(self, user_id=None):
        recent_spots = list(
            Spot.objects.filter(is_public=True)
            .annotate(likes_count=Count('likes'), average_rating=Avg('reviews__rating'))
            .prefetch_related('photos')
            .order_by('-created_at')[:50]
        )
        recent_trips = list(
            Trip.objects.filter(is_public=True)
            .prefetch_related('trip_spots__spot', 'members')
            .order_by('-created_at')[:50]
        )
        return recent_spots + recent_trips

    def trending_spots_queryset(self):
        return (
            Spot.objects.filter(is_public=True)
            .annotate(likes_count=Count('likes'), average_rating=Avg('reviews__rating'))
            .prefetch_related('photos')
            .order_by('-likes_count', '-created_at')
        )
