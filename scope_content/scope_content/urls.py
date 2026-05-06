from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from common.views import health_view, metrics_view
from common.views_search import GeoSearchView, SearchView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/content/health', health_view, name='content-health'),
    path('metrics', metrics_view, name='content-metrics'),
    path('api/content/metrics', metrics_view, name='content-metrics-api'),
    path('api/content/search', SearchView.as_view(), name='search'),
    path('api/content/search/nearby', GeoSearchView.as_view(), name='geo-search'),
    path('api/content/spots/', include('spots.urls')),
    path('api/content/trips/', include('trips.urls')),
    path('api/content/photos/', include('photos.urls')),
    path('api/content/reviews/', include('reviews.urls')),
    path('api/content/feed/', include('feed.urls')),
    path('api/content/interactions/', include('interactions.urls')),
]

if settings.DEBUG or getattr(settings, 'SERVE_LOCAL_MEDIA', False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
