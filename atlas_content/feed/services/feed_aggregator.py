from django.db.models import Count
from spots.models import Spot
from trips.models import Trip
class FeedAggregator:
    def social_feed_queryset(self, user_id=None):
        return list(Spot.objects.filter(is_public=True).annotate(likes_count=Count('likes')).order_by('-created_at')[:50]) + list(Trip.objects.filter(is_public=True).order_by('-created_at')[:50])
    def trending_spots_queryset(self):
        return Spot.objects.filter(is_public=True).annotate(likes_count=Count('likes')).order_by('-likes_count', '-created_at')
