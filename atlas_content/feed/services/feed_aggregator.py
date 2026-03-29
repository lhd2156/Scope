from spots.models import Spot
from spots.querysets import with_spot_list_relations
from trips.models import Trip
from trips.querysets import with_trip_relations


class FeedAggregator:
    def social_feed_queryset(self, user_id=None):
        spots = with_spot_list_relations(Spot.objects.filter(is_public=True)).order_by('-created_at')[:50]
        trips = with_trip_relations(Trip.objects.filter(is_public=True).order_by('-created_at'))[:50]
        return list(spots) + list(trips)

    def trending_spots_queryset(self):
        return with_spot_list_relations(Spot.objects.filter(is_public=True)).order_by('-likes_count', '-created_at')
