from django.urls import path

from reviews.views import review_detail, spot_reviews

urlpatterns = [
    path('spot/<uuid:spot_id>', spot_reviews),
    path('<uuid:pk>', review_detail),
]
