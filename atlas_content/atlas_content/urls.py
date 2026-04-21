from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from common.views import health_view, metrics_view
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/content/health', health_view, name='content-health'),
    path('metrics', metrics_view, name='content-metrics'),
    path('api/content/spots/', include('spots.urls')),
    path('api/content/trips/', include('trips.urls')),
    path('api/content/photos/', include('photos.urls')),
    path('api/content/reviews/', include('reviews.urls')),
    path('api/content/feed/', include('feed.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
