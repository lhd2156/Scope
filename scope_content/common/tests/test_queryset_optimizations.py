from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from feed.services.feed_aggregator import FeedAggregator, FeedReference
from photos.models import Photo
from reviews.models import Review
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot

pytestmark = pytest.mark.django_db


def _create_public_spot(*, user_id: str, title: str, latitude: float, longitude: float) -> Spot:
    return Spot.objects.create(
        user_id=user_id,
        title=title,
        description=f'{title} description',
        latitude=latitude,
        longitude=longitude,
        city='Fort Worth',
        country='US',
        category='food',
        vibe='chill',
        is_public=True,
    )


def test_explore_spots_prefetches_photo_urls_without_n_plus_one(api_client):
    for index in range(4):
        spot = _create_public_spot(
            user_id=str(uuid4()),
            title=f'Spot {index}',
            latitude=32.75 + index * 0.01,
            longitude=-97.33 - index * 0.01,
        )
        Photo.objects.create(
            spot=spot,
            user_id=spot.user_id,
            storage_key=f'photos/{index}.png',
            storage_url=f'https://example.com/photos/{index}.png',
            thumbnail_url=f'https://example.com/photos/{index}_thumb.png',
            caption=f'Photo {index}',
            sort_order=0,
        )

    with CaptureQueriesContext(connection) as queries:
        response = api_client.get('/api/content/spots/explore')

    assert response.status_code == 200
    assert response.json()['meta']['total'] == 4
    assert len(response.json()['data']) == 4
    assert len(queries) <= 3



def test_spot_detail_prefetches_photos_and_reviews_without_extra_queries(api_client, spot):
    for index in range(3):
        Photo.objects.create(
            spot=spot,
            user_id=spot.user_id,
            storage_key=f'photos/detail-{index}.png',
            storage_url=f'https://example.com/photos/detail-{index}.png',
            thumbnail_url=f'https://example.com/photos/detail-{index}_thumb.png',
            caption=f'Detail {index}',
            sort_order=index,
        )
        Review.objects.create(
            spot=spot,
            user_id=str(uuid4()),
            rating='4.0',
            comment=f'Review {index}',
        )

    with CaptureQueriesContext(connection) as queries:
        response = api_client.get(f'/api/content/spots/{spot.id}')

    assert response.status_code == 200
    assert len(response.json()['photos']) == 3
    assert len(response.json()['reviews']) == 3
    assert len(queries) <= 4



def test_public_trips_prefetches_members_and_trip_spots(api_client):
    owner_id = str(uuid4())
    for index in range(3):
        trip = Trip.objects.create(
            creator_id=owner_id,
            title=f'Trip {index}',
            description='Weekend route',
            start_date=date(2026, 3, 29),
            end_date=date(2026, 3, 30),
            is_public=True,
        )
        TripMember.objects.create(trip=trip, user_id=owner_id, role='owner')
        for spot_index in range(2):
            spot = _create_public_spot(
                user_id=owner_id,
                title=f'Trip Spot {index}-{spot_index}',
                latitude=32.8 + index * 0.01 + spot_index * 0.001,
                longitude=-97.3 - index * 0.01 - spot_index * 0.001,
            )
            TripSpot.objects.create(trip=trip, spot=spot, day_number=1, sort_order=spot_index)

    with CaptureQueriesContext(connection) as queries:
        response = api_client.get('/api/content/trips/public')

    assert response.status_code == 200
    assert response.json()['meta']['total'] == 3
    assert len(response.json()['data']) == 3
    assert all(item['spots'] for item in response.json()['data'])
    assert len(queries) <= 5



def test_social_feed_prefetches_related_spot_and_trip_data(authenticated_client, auth_header):
    _, owner_id = auth_header
    for index in range(3):
        spot = _create_public_spot(
            user_id=owner_id,
            title=f'Feed Spot {index}',
            latitude=32.7 + index * 0.01,
            longitude=-97.2 - index * 0.01,
        )
        Photo.objects.create(
            spot=spot,
            user_id=owner_id,
            storage_key=f'photos/feed-{index}.png',
            storage_url=f'https://example.com/photos/feed-{index}.png',
            thumbnail_url=f'https://example.com/photos/feed-{index}_thumb.png',
            caption=f'Feed {index}',
            sort_order=0,
        )
        Review.objects.create(
            spot=spot,
            user_id='22222222-2222-2222-2222-222222222222',
            rating='4.7',
            comment=f'Reviewed Feed Spot {index}',
        )

    for index in range(2):
        trip = Trip.objects.create(
            creator_id=owner_id,
            title=f'Feed Trip {index}',
            description='Feed route',
            is_public=True,
        )
        TripMember.objects.create(trip=trip, user_id=owner_id, role='owner')
        trip_spot = _create_public_spot(
            user_id=owner_id,
            title=f'Feed Trip Spot {index}',
            latitude=32.9 + index * 0.01,
            longitude=-97.1 - index * 0.01,
        )
        TripSpot.objects.create(trip=trip, spot=trip_spot, day_number=1, sort_order=0)

    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get('/api/content/feed/')

    assert response.status_code == 200
    assert len(response.json()['data']) == 10
    assert {item['type'] for item in response.json()['data']} == {'spot', 'trip', 'review'}
    review_entry = next(item for item in response.json()['data'] if item['type'] == 'review')
    assert review_entry['actor']['displayName'] == 'Maya Chen'
    assert review_entry['title'].startswith('Maya Chen reviewed Feed Spot')
    assert review_entry['targetId']
    assert 'item' not in review_entry
    assert len(queries) <= 9


def test_feed_aggregator_hydrates_only_the_current_page(monkeypatch):
    aggregator = FeedAggregator()
    now = datetime(2026, 4, 22, 12, 0, tzinfo=timezone.utc)
    spot_references = [
        FeedReference(type='spot', item_id=f'spot-{index}', created_at=now - timedelta(minutes=index * 2))
        for index in range(15)
    ]
    trip_references = [
        FeedReference(type='trip', item_id=f'trip-{index}', created_at=now - timedelta(minutes=index * 2 + 1))
        for index in range(15)
    ]
    hydrated_spot_ids = []
    hydrated_trip_ids = []

    monkeypatch.setattr(aggregator, '_load_spot_references', lambda cursor, limit: spot_references[:limit])
    monkeypatch.setattr(aggregator, '_load_trip_references', lambda cursor, limit: trip_references[:limit])
    monkeypatch.setattr(aggregator, '_load_review_references', lambda cursor, limit: [])

    def fake_hydrate_spots(spot_ids):
        hydrated_spot_ids.extend(spot_ids)
        return {spot_id: {'kind': 'spot', 'id': spot_id} for spot_id in spot_ids}

    def fake_hydrate_trips(trip_ids):
        hydrated_trip_ids.extend(trip_ids)
        return {trip_id: {'kind': 'trip', 'id': trip_id} for trip_id in trip_ids}

    monkeypatch.setattr(aggregator, '_hydrate_spots', fake_hydrate_spots)
    monkeypatch.setattr(aggregator, '_hydrate_trips', fake_hydrate_trips)
    monkeypatch.setattr(aggregator, '_hydrate_reviews', lambda review_ids: {})

    page = aggregator.social_feed_page(page_size=20)

    assert len(page.entries) == 20
    assert page.has_more is True
    assert len(hydrated_spot_ids) == 10
    assert len(hydrated_trip_ids) == 10
    assert [entry.type for entry in page.entries[:4]] == ['spot', 'trip', 'spot', 'trip']


def test_spot_photos_endpoint_reads_only_the_list_payload_fields(api_client, spot):
    for index in range(3):
        Photo.objects.create(
            spot=spot,
            user_id=spot.user_id,
            storage_key=f'photos/list-{index}.png',
            storage_url=f'https://example.com/photos/list-{index}.png',
            thumbnail_url=f'https://example.com/photos/list-{index}_thumb.png',
            caption=f'List {index}',
            sort_order=index,
        )

    with CaptureQueriesContext(connection) as queries:
        response = api_client.get(f'/api/content/spots/{spot.id}/photos')

    assert response.status_code == 200
    assert [item['caption'] for item in response.json()['data']] == ['List 0', 'List 1', 'List 2']
    assert len(queries) <= 1


def test_reorder_trip_spots_updates_in_bulk_and_serializes_prefetched_relations(authenticated_client, auth_header, trip):
    _, owner_user_id = auth_header
    spots = [
        Spot.objects.create(
            user_id=owner_user_id,
            title=f'Reorder Spot {index}',
            latitude=32.8 + index * 0.01,
            longitude=-97.3 - index * 0.01,
            category='food',
        )
        for index in range(3)
    ]
    for index, spot in enumerate(spots):
        TripSpot.objects.create(trip=trip, spot=spot, day_number=1, sort_order=index)

    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.put(
            f'/api/content/trips/{trip.id}/spots/reorder',
            {
                'spots': [
                    {'spotId': str(spots[0].id), 'sortOrder': 2, 'dayNumber': 2},
                    {'spotId': str(spots[1].id), 'sortOrder': 1, 'dayNumber': 2},
                    {'spotId': str(spots[2].id), 'sortOrder': 0, 'dayNumber': 2},
                ]
            },
            format='json',
        )

    assert response.status_code == 200
    assert [item['spot_title'] for item in response.json()['data']['spots']] == [
        'Reorder Spot 2',
        'Reorder Spot 1',
        'Reorder Spot 0',
    ]
    assert len(queries) <= 8
