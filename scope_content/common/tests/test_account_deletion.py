from __future__ import annotations

from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from comments.models import Comment, CommentMention
from interactions.models import Interaction
from photos.models import Photo
from reviews.models import Review
from spots.models import Spot
from trips.models import Like, Trip, TripMember

pytestmark = pytest.mark.django_db


def _spot(user_id, title: str) -> Spot:
    return Spot.objects.create(
        user_id=user_id,
        title=title,
        latitude=32.75,
        longitude=-97.33,
        city='Fort Worth',
        country='US',
        category='food',
    )


def test_delete_current_user_content_requires_authentication_and_explicit_confirmation(
    authenticated_client,
):
    assert APIClient().delete('/api/content/users/me').status_code == 401

    missing_confirmation = authenticated_client.delete('/api/content/users/me')
    assert missing_confirmation.status_code == 400
    assert missing_confirmation.json()['error']['code'] == 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED'


def test_delete_current_user_content_erases_owned_and_authored_records(
    authenticated_client,
    auth_header,
    monkeypatch,
):
    _, user_id = auth_header
    other_user_id = uuid4()
    owned_spot = _spot(user_id, 'Owned spot')
    other_spot = _spot(other_user_id, 'Other spot')
    owned_trip = Trip.objects.create(creator_id=user_id, title='Owned trip')
    other_trip = Trip.objects.create(creator_id=other_user_id, title='Other trip')
    TripMember.objects.create(trip=owned_trip, user_id=user_id, role='owner')
    TripMember.objects.create(trip=other_trip, user_id=user_id, role='viewer')

    Like.objects.create(spot=other_spot, user_id=user_id)
    authored_review = Review.objects.create(spot=other_spot, user_id=user_id, rating=4)
    retained_review = Review.objects.create(spot=other_spot, user_id=other_user_id, rating=5)
    authored_photo = Photo.objects.create(
        spot=other_spot,
        user_id=user_id,
        storage_key='photos/authored.png',
        storage_url='/media/photos/authored.png',
        thumbnail_url='/media/photos/authored_thumb.webp',
    )
    owned_spot_photo = Photo.objects.create(
        spot=owned_spot,
        user_id=other_user_id,
        storage_key='photos/owned-spot.png',
        storage_url='/media/photos/owned-spot.png',
        thumbnail_url='',
    )
    authored_comment = Comment.objects.create(
        target_type=Comment.TARGET_SPOT,
        target_id=other_spot.id,
        user_id=user_id,
        body='Authored comment',
    )
    retained_comment = Comment.objects.create(
        target_type=Comment.TARGET_SPOT,
        target_id=other_spot.id,
        user_id=other_user_id,
        body='Retained comment',
    )
    comment_on_owned_spot = Comment.objects.create(
        target_type=Comment.TARGET_SPOT,
        target_id=owned_spot.id,
        user_id=other_user_id,
        body='Removed with owned spot',
    )
    mention = CommentMention.objects.create(
        comment=retained_comment,
        mentioned_user_id=user_id,
    )
    authored_interaction = Interaction.objects.create(
        user_id=user_id,
        spot_id=other_spot.id,
        interaction_type='view',
    )
    retained_interaction = Interaction.objects.create(
        user_id=other_user_id,
        spot_id=other_spot.id,
        interaction_type='view',
    )

    deleted_assets = []
    deleted_indexes = {'spot': [], 'trip': [], 'review': []}
    monkeypatch.setattr(
        'common.account_deletion.S3StorageService.delete_asset',
        lambda _self, value: deleted_assets.append(value),
    )
    monkeypatch.setattr(
        'common.account_deletion.delete_spot',
        lambda value: deleted_indexes['spot'].append(value),
    )
    monkeypatch.setattr(
        'common.account_deletion.delete_trip',
        lambda value: deleted_indexes['trip'].append(value),
    )
    monkeypatch.setattr(
        'common.account_deletion.delete_review',
        lambda value: deleted_indexes['review'].append(value),
    )

    response = authenticated_client.delete(
        '/api/content/users/me',
        HTTP_X_SCOPE_ACCOUNT_DELETION='confirm',
    )

    assert response.status_code == 204
    assert not Spot.objects.filter(pk=owned_spot.id).exists()
    assert Spot.objects.filter(pk=other_spot.id).exists()
    assert not Trip.objects.filter(pk=owned_trip.id).exists()
    assert Trip.objects.filter(pk=other_trip.id).exists()
    assert not TripMember.objects.filter(user_id=user_id).exists()
    assert not Like.objects.filter(user_id=user_id).exists()
    assert not Review.objects.filter(pk=authored_review.id).exists()
    assert Review.objects.filter(pk=retained_review.id).exists()
    assert not Photo.objects.filter(pk__in=[authored_photo.id, owned_spot_photo.id]).exists()
    assert not Comment.objects.filter(pk__in=[authored_comment.id, comment_on_owned_spot.id]).exists()
    assert Comment.objects.filter(pk=retained_comment.id).exists()
    assert not CommentMention.objects.filter(pk=mention.id).exists()
    assert not Interaction.objects.filter(pk=authored_interaction.id).exists()
    assert Interaction.objects.filter(pk=retained_interaction.id).exists()
    assert set(deleted_assets) == {
        'photos/authored.png',
        '/media/photos/authored_thumb.webp',
        'photos/owned-spot.png',
    }
    assert deleted_indexes == {
        'spot': [str(owned_spot.id)],
        'trip': [str(owned_trip.id)],
        'review': [str(authored_review.id)],
    }
