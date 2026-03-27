from bootstrap_content import w

w('photos/views.py', '''import uuid
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from photos.serializers import PhotoSerializer, PhotoUploadSerializer
from photos.services.s3_service import S3StorageService
from spots.models import Spot
producer = AtlasKafkaProducer()
@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def upload_photo(request):
    serializer = PhotoUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    spot = get_object_or_404(Spot, id=serializer.validated_data['spot_id'])
    upload = S3StorageService().store(serializer.validated_data['file'])
    photo = Photo.objects.create(spot=spot, user_id=request.user.id, caption=serializer.validated_data.get('caption', ''), sort_order=serializer.validated_data.get('sort_order', 0), **upload)
    producer.publish('photo.uploaded', {'photoId': str(photo.id), 'spotId': str(spot.id), 'userId': str(request.user.id)})
    return data_response(PhotoSerializer(photo).data, status_code=201)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def photo_detail(request, pk):
    photo = get_object_or_404(Photo, pk=pk)
    if str(photo.user_id) != str(request.user.id) and not getattr(request.user, 'is_admin', False):
        return data_response({'message': 'forbidden'}, status_code=403)
    if request.method == 'DELETE':
        photo.delete()
        return data_response({'deleted': True})
    serializer = PhotoSerializer(photo, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return data_response(serializer.data)
@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def presigned_url(request):
    key = f'photos/{uuid.uuid4()}.jpg'
    url = S3StorageService().presigned_upload_url(key)
    return data_response({'key': key, 'url': url, 'enabled': bool(url)})
''')

w('reviews/views.py', '''from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from reviews.models import Review
from reviews.serializers import ReviewSerializer
from spots.models import Spot
producer = AtlasKafkaProducer()
@api_view(['POST', 'GET'])
def spot_reviews(request, spot_id):
    spot = get_object_or_404(Spot, pk=spot_id)
    if request.method == 'GET':
        return data_response(ReviewSerializer(Review.objects.filter(spot=spot), many=True).data)
    if not getattr(request.user, 'is_authenticated', False):
        return data_response({'message': 'auth required'}, status_code=401)
    instance = Review.objects.filter(spot=spot, user_id=request.user.id).first()
    serializer = ReviewSerializer(instance, data=request.data, partial=bool(instance))
    serializer.is_valid(raise_exception=True)
    review = serializer.save(spot=spot, user_id=request.user.id)
    producer.publish('review.created', {'reviewId': str(review.id), 'spotId': str(spot.id), 'userId': str(request.user.id)})
    return data_response(ReviewSerializer(review).data, status_code=201 if instance is None else 200)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def review_detail(request, pk):
    review = get_object_or_404(Review, pk=pk)
    if str(review.user_id) != str(request.user.id) and not getattr(request.user, 'is_admin', False):
        return data_response({'message': 'forbidden'}, status_code=403)
    if request.method == 'DELETE':
        review.delete()
        return data_response({'deleted': True})
    serializer = ReviewSerializer(review, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return data_response(serializer.data)
''')

w('feed/views.py', '''from rest_framework.decorators import api_view
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
''')

w('spots/urls.py', "from django.urls import path\nfrom spots.views import SpotDetailView, SpotListCreateView, explore_spots, like_spot, nearby_spots, spot_photos, user_spots\nurlpatterns = [path('', SpotListCreateView.as_view()), path('nearby', nearby_spots), path('explore', explore_spots), path('user/<uuid:user_id>', user_spots), path('<uuid:pk>', SpotDetailView.as_view()), path('<uuid:pk>/like', like_spot), path('<uuid:pk>/photos', spot_photos)]\n")
w('trips/urls.py', "from django.urls import path\nfrom trips.views import TripDetailView, TripListCreateView, add_trip_spot, public_trips, remove_trip_member, remove_trip_spot, reorder_trip_spots, trip_members\nurlpatterns = [path('', TripListCreateView.as_view()), path('public', public_trips), path('<uuid:pk>', TripDetailView.as_view()), path('<uuid:pk>/spots', add_trip_spot), path('<uuid:pk>/spots/reorder', reorder_trip_spots), path('<uuid:pk>/spots/<uuid:spot_id>', remove_trip_spot), path('<uuid:pk>/members', trip_members), path('<uuid:pk>/members/<uuid:user_id>', remove_trip_member)]\n")
w('photos/urls.py', "from django.urls import path\nfrom photos.views import photo_detail, presigned_url, upload_photo\nurlpatterns = [path('upload', upload_photo), path('presigned-url', presigned_url), path('<uuid:pk>', photo_detail)]\n")
w('reviews/urls.py', "from django.urls import path\nfrom reviews.views import review_detail, spot_reviews\nurlpatterns = [path('spot/<uuid:spot_id>', spot_reviews), path('<uuid:pk>', review_detail)]\n")
w('feed/urls.py', "from django.urls import path\nfrom feed.views import social_feed, trending_spots\nurlpatterns = [path('', social_feed), path('trending', trending_spots)]\n")

w('conftest.py', '''import uuid
import jwt
import pytest
from django.conf import settings
from rest_framework.test import APIClient
from spots.models import Spot
from trips.models import Trip, TripMember
@pytest.fixture
def api_client():
    return APIClient()
@pytest.fixture
def auth_header():
    user_id = str(uuid.uuid4())
    token = jwt.encode({'sub': user_id, 'email': 'test@example.com', 'name': 'Tester', 'roles': ['user'], 'iss': settings.JWT_ISSUER, 'aud': settings.JWT_AUDIENCE, 'exp': 4102444800}, settings.JWT_SECRET, algorithm='HS256')
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}, user_id
@pytest.fixture
def spot(auth_header):
    _, user_id = auth_header
    return Spot.objects.create(user_id=user_id, title='Fort Worth Tacos', description='Great tacos', latitude=32.75, longitude=-97.33, city='Fort Worth', country='US', category='food', vibe='chill', rating=4.5)
@pytest.fixture
def trip(auth_header):
    _, user_id = auth_header
    trip = Trip.objects.create(creator_id=user_id, title='Weekend', status='planning')
    TripMember.objects.create(trip=trip, user_id=user_id, role='owner')
    return trip
''')
w('pytest.ini', "[pytest]\nDJANGO_SETTINGS_MODULE = atlas_content.settings\npython_files = tests.py test_*.py *_tests.py\n")
for pkg in ['common/tests/__init__.py','spots/tests/__init__.py','trips/tests/__init__.py','photos/tests/__init__.py','reviews/tests/__init__.py','feed/tests/__init__.py']:
    w(pkg, '')
w('spots/tests/test_spots_api.py', '''from spots.models import Spot

def test_create_spot(api_client, auth_header):
    headers, _ = auth_header
    response = api_client.post('/api/content/spots/', {'title': 'Best Tacos in Fort Worth', 'description': 'Incredible street tacos', 'latitude': 32.7555, 'longitude': -97.3308, 'address': '123 Main St', 'city': 'Fort Worth', 'country': 'US', 'category': 'food', 'vibe': 'chill', 'rating': '4.5', 'visited_at': '2026-03-20', 'is_public': True}, format='json', **headers)
    assert response.status_code == 201
    assert response.json()['data']['title'] == 'Best Tacos in Fort Worth'
    assert Spot.objects.count() == 1

def test_list_spots(api_client, spot):
    response = api_client.get('/api/content/spots/')
    assert response.status_code == 200
    body = response.json()
    assert body['meta']['total'] == 1
    assert body['data'][0]['title'] == 'Fort Worth Tacos'

def test_nearby_spots(api_client, spot):
    response = api_client.get('/api/content/spots/nearby', {'lat': 32.75, 'lng': -97.33, 'radius': 3})
    assert response.status_code == 200
    assert response.json()['meta']['total'] == 1
''')
w('trips/tests/test_trips_api.py', '''from spots.models import Spot
from trips.models import TripMember, TripSpot

def test_create_trip(api_client, auth_header):
    headers, _ = auth_header
    response = api_client.post('/api/content/trips/', {'title': 'Road Trip', 'description': 'West loop', 'status': 'planning'}, format='json', **headers)
    assert response.status_code == 201
    assert response.json()['data']['title'] == 'Road Trip'

def test_add_member_and_spot(api_client, auth_header, trip):
    headers, user_id = auth_header
    spot = Spot.objects.create(user_id=user_id, title='Canyon', latitude=31.0, longitude=-97.0, category='nature')
    member_response = api_client.post(f'/api/content/trips/{trip.id}/members', {'user_id': '11111111-1111-1111-1111-111111111111', 'role': 'viewer'}, format='json', **headers)
    assert member_response.status_code == 201
    spot_response = api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(spot.id), 'day_number': 1, 'sort_order': 0}, format='json', **headers)
    assert spot_response.status_code == 201
    assert TripMember.objects.filter(trip=trip).count() == 2
    assert TripSpot.objects.filter(trip=trip).count() == 1

def test_reorder_trip_spots(api_client, auth_header, trip):
    headers, user_id = auth_header
    first = Spot.objects.create(user_id=user_id, title='A', latitude=31.0, longitude=-97.0, category='nature')
    second = Spot.objects.create(user_id=user_id, title='B', latitude=32.0, longitude=-98.0, category='nature')
    api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(first.id), 'day_number': 1, 'sort_order': 0}, format='json', **headers)
    api_client.post(f'/api/content/trips/{trip.id}/spots', {'spot_id': str(second.id), 'day_number': 1, 'sort_order': 1}, format='json', **headers)
    response = api_client.put(f'/api/content/trips/{trip.id}/spots/reorder', {'spots': [{'spotId': str(first.id), 'sortOrder': 2, 'dayNumber': 2}, {'spotId': str(second.id), 'sortOrder': 1, 'dayNumber': 2}]}, format='json', **headers)
    assert response.status_code == 200
    reordered = {str(item['spot']): item for item in response.json()['data']['spots']}
    assert reordered[str(first.id)]['day_number'] == 2
''')
w('Dockerfile', '''FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/content/health')"
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
''')
