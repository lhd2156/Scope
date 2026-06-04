from django.urls import path

from trips.views import (
    TripDetailView,
    TripListCreateView,
    add_trip_spot,
    public_trips,
    remove_trip_member,
    remove_trip_spot,
    reorder_trip_spots,
    share_trip,
    shared_trip_detail,
    trip_members,
)

urlpatterns = [
    path('', TripListCreateView.as_view()),
    path('public', public_trips),
    path('share/<uuid:token>', shared_trip_detail),
    path('<uuid:pk>', TripDetailView.as_view()),
    path('<uuid:pk>/share', share_trip),
    path('<uuid:pk>/spots', add_trip_spot),
    path('<uuid:pk>/spots/reorder', reorder_trip_spots),
    path('<uuid:pk>/spots/<uuid:spot_id>', remove_trip_spot),
    path('<uuid:pk>/members', trip_members),
    path('<uuid:pk>/members/<uuid:user_id>', remove_trip_member),
]
