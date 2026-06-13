from __future__ import annotations

from datetime import datetime
from io import BytesIO
from uuid import UUID, uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

import interactions.views as interaction_views
import photos.views as photo_views
import reviews.views as review_views
import spots.views as spot_views
import trips.views as trip_views
from common.kafka_producer import ScopeKafkaProducer
from interactions.models import Interaction
from spots.models import Spot

pytestmark = pytest.mark.django_db


@pytest.fixture
def published_events(monkeypatch):
    events: list[dict[str, object]] = []

    def capture(topic: str, data: dict, **_kwargs):
        events.append({'topic': topic, 'data': data})

    monkeypatch.setattr(spot_views.producer, 'publish', capture)
    monkeypatch.setattr(trip_views.producer, 'publish', capture)
    monkeypatch.setattr(review_views.producer, 'publish', capture)
    monkeypatch.setattr(photo_views.producer, 'publish', capture)
    monkeypatch.setattr(interaction_views.producer, 'publish', capture)
    return events


@override_settings(KAFKA_ENABLED=True, KAFKA_BOOTSTRAP_SERVERS='broker-a:9092,broker-b:9092')
def test_scope_kafka_producer_emits_architecture_event_envelope(monkeypatch):
    captured: dict[str, object] = {}

    class FakeKafkaProducer:
        def __init__(self, *args, **kwargs):
            captured['args'] = args
            captured['kwargs'] = kwargs

        def send(self, topic: str, value: dict):
            captured['topic'] = topic
            captured['value'] = value

    monkeypatch.setattr('common.kafka_producer.KafkaProducer', FakeKafkaProducer)

    producer = ScopeKafkaProducer()
    producer.publish('spot.created', {'spotId': 'spot-123', 'userId': 'user-123'})

    assert captured['kwargs']['bootstrap_servers'] == ['broker-a:9092', 'broker-b:9092']
    assert captured['topic'] == 'spot.created'

    event = captured['value']
    UUID(event['eventId'])
    assert event['eventType'] == 'spot.created'
    assert event['source'] == 'content-engine'
    assert event['data'] == {'spotId': 'spot-123', 'userId': 'user-123'}
    assert event['timestamp'].endswith('Z')
    assert datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00')).tzinfo is not None


@pytest.mark.django_db
def test_spot_create_publishes_documented_event_payload(authenticated_client, auth_header, published_events):
    _, owner_user_id = auth_header

    response = authenticated_client.post(
        '/api/content/spots/',
        {
            'title': 'Best Tacos in Fort Worth',
            'description': 'Incredible street tacos',
            'latitude': 32.7555,
            'longitude': -97.3308,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': '4.5',
            'visited_at': '2026-03-20',
            'is_public': False,
        },
        format='json',
    )

    assert response.status_code == 201
    assert published_events[0]['topic'] == 'spot.created'
    data = published_events[0]['data']
    assert 'occurredAt' in data
    assert data['spotId'] == response.json()['data']['id']
    assert data['userId'] == owner_user_id
    assert data['ownerUserId'] == owner_user_id
    assert data['title'] == 'Best Tacos in Fort Worth'
    assert data['spotTitle'] == 'Best Tacos in Fort Worth'
    assert data['description'] == 'Incredible street tacos'
    assert data['latitude'] == 32.7555
    assert data['longitude'] == -97.3308
    assert data['category'] == 'food'
    assert data['vibe'] == 'chill'
    assert data['isPublic'] is False
    datetime.fromisoformat(data['occurredAt'].replace('Z', '+00:00'))


@pytest.mark.django_db
def test_spot_update_publishes_spot_updated_event(authenticated_client, auth_header, published_events, spot):
    _, owner_user_id = auth_header

    response = authenticated_client.put(
        f'/api/content/spots/{spot.id}',
        {
            'title': 'Updated Fort Worth Tacos',
            'description': 'Even better tacos',
            'latitude': 32.75,
            'longitude': -97.33,
            'address': '123 Main St',
            'city': 'Fort Worth',
            'country': 'US',
            'category': 'food',
            'vibe': 'chill',
            'rating': '4.7',
            'is_public': True,
        },
        format='json',
    )

    assert response.status_code == 200
    assert published_events[0]['topic'] == 'spot.updated'
    data = published_events[0]['data']
    assert data['spotId'] == str(spot.id)
    assert data['userId'] == owner_user_id
    assert data['ownerUserId'] == owner_user_id
    assert data['title'] == 'Updated Fort Worth Tacos'
    assert data['spotTitle'] == 'Updated Fort Worth Tacos'
    assert data['description'] == 'Even better tacos'
    datetime.fromisoformat(data['occurredAt'].replace('Z', '+00:00'))


@pytest.mark.django_db
def test_spot_like_only_publishes_when_like_is_created(authenticated_client, auth_header, published_events, spot):
    _, owner_user_id = auth_header

    first_response = authenticated_client.post(f'/api/content/spots/{spot.id}/like')
    second_response = authenticated_client.post(f'/api/content/spots/{spot.id}/like')

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    assert len(published_events) == 1
    assert published_events[0]['topic'] == 'spot.liked'
    assert published_events[0]['data']['spotId'] == str(spot.id)
    assert published_events[0]['data']['userId'] == owner_user_id
    assert published_events[0]['data']['ownerUserId'] == str(spot.user_id)
    assert published_events[0]['data']['spotTitle'] == spot.title
    assert published_events[0]['data']['interactionType'] == 'like'
    datetime.fromisoformat(published_events[0]['data']['occurredAt'].replace('Z', '+00:00'))


@pytest.mark.django_db
def test_trip_create_publishes_trip_created_event(authenticated_client, auth_header, published_events):
    _, owner_user_id = auth_header

    response = authenticated_client.post(
        '/api/content/trips/',
        {'title': 'Road Trip', 'description': 'West loop', 'status': 'planning'},
        format='json',
    )

    assert response.status_code == 201
    assert len(published_events) == 1
    assert published_events[0]['topic'] == 'trip.created'
    assert published_events[0]['data']['tripId'] == response.json()['data']['id']
    assert published_events[0]['data']['userId'] == owner_user_id
    assert published_events[0]['data']['creatorId'] == owner_user_id
    assert published_events[0]['data']['ownerUserId'] == owner_user_id
    assert published_events[0]['data']['tripTitle'] == 'Road Trip'


@pytest.mark.django_db
def test_trip_member_added_event_only_fires_for_new_member(authenticated_client, trip, published_events):
    first_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': '11111111-1111-1111-1111-111111111111', 'role': 'viewer'},
        format='json',
    )
    second_response = authenticated_client.post(
        f'/api/content/trips/{trip.id}/members',
        {'user_id': '11111111-1111-1111-1111-111111111111', 'role': 'editor'},
        format='json',
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    assert len(published_events) == 1
    assert published_events[0]['topic'] == 'trip.member.added'
    assert published_events[0]['data']['tripId'] == str(trip.id)
    assert published_events[0]['data']['userId'] == '11111111-1111-1111-1111-111111111111'
    assert published_events[0]['data']['addedUserId'] == '11111111-1111-1111-1111-111111111111'
    assert published_events[0]['data']['ownerUserId'] == str(trip.creator_id)
    assert published_events[0]['data']['tripTitle'] == trip.title


@pytest.mark.django_db
def test_review_created_event_only_fires_for_new_review(authenticated_client, auth_header, published_events, spot):
    _, owner_user_id = auth_header

    first_response = authenticated_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.5', 'comment': 'Love this place'},
        format='json',
    )
    second_response = authenticated_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': '4.0', 'comment': 'Updated take'},
        format='json',
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    assert len(published_events) == 1
    assert published_events[0]['topic'] == 'review.created'
    assert published_events[0]['data']['reviewId'] == first_response.json()['data']['id']
    assert published_events[0]['data']['spotId'] == str(spot.id)
    assert published_events[0]['data']['userId'] == owner_user_id
    assert published_events[0]['data']['ownerUserId'] == str(spot.user_id)
    assert published_events[0]['data']['spotTitle'] == spot.title
    assert published_events[0]['data']['interactionType'] == 'review'
    assert published_events[0]['data']['rating'] == 4.5
    assert published_events[0]['data']['sentimentScore'] == 0.0
    datetime.fromisoformat(published_events[0]['data']['occurredAt'].replace('Z', '+00:00'))


@pytest.mark.django_db
def test_interactions_are_append_only_and_publish_event_envelopes(authenticated_client, auth_header, published_events, spot):
    _, owner_user_id = auth_header

    first_response = authenticated_client.post(
        '/api/content/interactions/',
        {
            'spotId': str(spot.id),
            'interactionType': 'view',
            'context': {'surface': 'map'},
        },
        format='json',
    )
    second_response = authenticated_client.post(
        '/api/content/interactions/',
        {
            'spotId': str(spot.id),
            'interactionType': 'view',
            'context': {'surface': 'detail'},
        },
        format='json',
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert Interaction.objects.filter(user_id=owner_user_id, spot_id=spot.id).count() == 2
    assert [event['topic'] for event in published_events] == ['interaction.recorded', 'interaction.recorded']
    first_event = published_events[0]['data']
    second_event = published_events[1]['data']
    assert first_event['interactionId'] != second_event['interactionId']
    assert first_event['userId'] == owner_user_id
    assert first_event['spotId'] == str(spot.id)
    assert first_event['interactionType'] == 'view'
    assert first_event['context'] == {'surface': 'map'}
    datetime.fromisoformat(first_event['occurredAt'].replace('Z', '+00:00'))
    assert second_event['context'] == {'surface': 'detail'}
    datetime.fromisoformat(second_event['occurredAt'].replace('Z', '+00:00'))


@pytest.mark.django_db
def test_interactions_reject_cross_user_private_spots(authenticated_client, auth_header, published_events):
    _, caller_user_id = auth_header
    private_spot = Spot.objects.create(
        user_id=uuid4(),
        title='Private overlook',
        description='Not visible to this caller',
        latitude=32.75,
        longitude=-97.33,
        city='Fort Worth',
        country='US',
        category='scenic',
        vibe='quiet',
        is_public=False,
    )

    response = authenticated_client.post(
        '/api/content/interactions/',
        {
            'spotId': str(private_spot.id),
            'interactionType': 'save',
            'context': {'surface': 'direct-id'},
        },
        format='json',
    )

    assert response.status_code == 404
    assert Interaction.objects.filter(user_id=caller_user_id, spot_id=private_spot.id).count() == 0
    assert published_events == []


@pytest.mark.django_db
def test_photo_upload_publishes_photo_uploaded_event(authenticated_client, auth_header, published_events, monkeypatch, spot):
    _, owner_user_id = auth_header

    monkeypatch.setattr(
        'photos.views.S3StorageService.store',
        lambda self, file: {
            'storage_key': 'photos/test.png',
            'storage_url': 'https://example.com/photos/test.png',
            'thumbnail_url': 'https://example.com/photos/test-thumb.png',
        },
    )

    image = Image.new('RGB', (8, 8), color='red')
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    upload = SimpleUploadedFile('spot.png', buffer.getvalue(), content_type='image/png')

    response = authenticated_client.post(
        '/api/content/photos/upload',
        {
            'spot_id': str(spot.id),
            'file': upload,
            'caption': 'Sunset tacos',
            'sort_order': 0,
        },
        format='multipart',
    )

    assert response.status_code == 201
    assert published_events == [
        {
            'topic': 'photo.uploaded',
            'data': {
                'photoId': response.json()['data']['id'],
                'spotId': str(spot.id),
                'userId': owner_user_id,
                'storageUrl': 'https://example.com/photos/test.png',
                'thumbnailUrl': 'https://example.com/photos/test-thumb.png',
            },
        }
    ]
