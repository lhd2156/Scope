from django.urls import path

from spots.views import (
    SpotDetailView,
    SpotListCreateView,
    compose_spot,
    explore_spots,
    like_spot,
    nearby_spots,
    saved_spots,
    spot_photos,
    user_spots,
)

urlpatterns = [
    path('', SpotListCreateView.as_view()),
    path('compose', compose_spot),
    path('nearby', nearby_spots),
    path('explore', explore_spots),
    path('saved', saved_spots),
    path('user/<uuid:user_id>', user_spots),
    path('<uuid:pk>', SpotDetailView.as_view()),
    path('<uuid:pk>/like', like_spot),
    path('<uuid:pk>/photos', spot_photos),
]
