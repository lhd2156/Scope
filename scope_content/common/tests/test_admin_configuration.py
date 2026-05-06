from __future__ import annotations

import pytest
from django.contrib import admin

from photos.admin import PhotoAdmin
from photos.models import Photo
from reviews.admin import ReviewAdmin
from reviews.models import Review
from spots.admin import SpotAdmin
from spots.models import Spot
from trips.admin import (
    LikeAdmin,
    TripAdmin,
    TripMemberAdmin,
    TripMemberInline,
    TripSpotAdmin,
    TripSpotInline,
)
from trips.models import Like, Trip, TripMember, TripSpot

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ('model', 'admin_class'),
    [
        (Spot, SpotAdmin),
        (Photo, PhotoAdmin),
        (Review, ReviewAdmin),
        (Trip, TripAdmin),
        (TripSpot, TripSpotAdmin),
        (TripMember, TripMemberAdmin),
        (Like, LikeAdmin),
    ],
)
def test_models_are_registered_with_expected_admin_classes(model, admin_class):
    registered_admin = admin.site._registry.get(model)

    assert registered_admin is not None
    assert isinstance(registered_admin, admin_class)



def test_trip_admin_exposes_expected_inlines_and_list_configuration():
    trip_admin = admin.site._registry[Trip]

    assert trip_admin.inlines == (TripSpotInline, TripMemberInline)
    assert trip_admin.list_display == ('title', 'creator_id', 'status', 'is_public', 'start_date', 'end_date', 'created_at')
    assert trip_admin.ordering == ('-created_at',)



def test_photo_and_review_admins_select_related_spot_for_changelists():
    photo_admin = admin.site._registry[Photo]
    review_admin = admin.site._registry[Review]

    assert photo_admin.list_select_related == ('spot',)
    assert review_admin.list_select_related == ('spot',)



def test_spot_admin_supports_search_and_filters_for_moderation():
    spot_admin = admin.site._registry[Spot]

    assert 'title' in spot_admin.search_fields
    assert 'city' in spot_admin.search_fields
    assert 'category' in spot_admin.list_filter
    assert 'is_public' in spot_admin.list_filter
