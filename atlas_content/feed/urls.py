from django.urls import path

from feed.views import social_feed, trending_spots

urlpatterns = [
    path('', social_feed),
    path('trending', trending_spots),
]
