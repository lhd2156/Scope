from __future__ import annotations

import runpy
import sys
import uuid
from decimal import Decimal
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from django.test import RequestFactory, override_settings
from rest_framework.exceptions import ValidationError

from comments import views as comment_views
from comments.models import Comment
from comments.serializers import CommentSerializer
from common import auth as content_auth
from common.middleware import rate_limit as legacy_rate_limit
from common.middleware import ratelimit
from common.views import _metrics_allowlist
from feed.views import _collect_feed_user_ids
from interactions.serializers import InteractionSerializer
from photos.serializers import AvatarUploadSerializer
from reviews.serializers import ReviewSerializer
from spots import serializers as spot_serializers
from spots import views as spot_views
from spots.models import Spot
from trips.models import Trip
from trips.serializers import TripAddSpotSerializer, TripSerializer

pytestmark = pytest.mark.django_db


def test_serializer_remaining_negative_and_happy_branch_edges(settings):
    interaction_serializer = InteractionSerializer()
    assert interaction_serializer.validate_context(None) is None
    with pytest.raises(ValidationError):
        interaction_serializer.validate_context(["not", "an", "object"])
    too_many_context_keys = dict.fromkeys(
        (
            "k00",
            "k01",
            "k02",
            "k03",
            "k04",
            "k05",
            "k06",
            "k07",
            "k08",
            "k09",
            "k10",
            "k11",
            "k12",
            "k13",
            "k14",
            "k15",
            "k16",
        ),
        "value",
    )
    with pytest.raises(ValidationError):
        interaction_serializer.validate_context(too_many_context_keys)

    comment_serializer = CommentSerializer()
    assert comment_serializer.validate_target_type(" SPOT ") == Comment.TARGET_SPOT
    assert comment_serializer.validate_body(" body ") == "body"

    avatar_serializer = AvatarUploadSerializer()
    settings.MAX_UPLOAD_BYTES = 10
    settings.ALLOWED_IMAGE_TYPES = ["image/png"]
    with pytest.raises(ValidationError):
        avatar_serializer.validate_file(SimpleNamespace(size=11))
    bad_upload = SimpleNamespace(size=1, read=lambda *_args: b"not an image", seek=lambda *_args: None)
    with pytest.raises(ValidationError):
        avatar_serializer.validate_file(bad_upload)

    with pytest.raises(ValidationError):
        ReviewSerializer().validate_rating(Decimal("0.9"))


def test_trip_serializer_remaining_branch_edges(spot):
    serializer = TripSerializer()

    assert serializer._can_view_members(Trip(), SimpleNamespace(is_admin=True)) is True
    assert serializer._can_view_members(Trip(), SimpleNamespace(is_authenticated=True, id=None)) is False
    with pytest.raises(ValidationError):
        serializer.to_internal_value(object())

    generated_spot_serializer = TripAddSpotSerializer(
        data={"title": "Generated stop", "latitude": 32.75, "longitude": -97.33}
    )
    assert generated_spot_serializer.is_valid(), generated_spot_serializer.errors

    existing_spot_serializer = TripAddSpotSerializer(data={"spotId": str(spot.id)})
    assert existing_spot_serializer.is_valid(), existing_spot_serializer.errors


def test_spot_serializer_and_nearby_remaining_branch_edges():
    photo = SimpleNamespace(id=uuid.uuid4(), storage_url="/media/photos/original.png", thumbnail_url="")
    spot_like = SimpleNamespace(
        is_public=True,
        photos=SimpleNamespace(order_by=lambda *_args: [photo]),
    )
    assert spot_serializers.AppendixBSpotListItemSerializer().get_photoUrl(spot_like) == "/media/photos/original.png"

    Spot.objects.create(
        user_id=uuid.uuid4(),
        title="Inside the box but outside the circle",
        latitude=0.07,
        longitude=0.07,
        category="scenic",
    )
    nearby = spot_serializers.NearbyQuerySerializer(data={"lat": 0, "lng": 0, "radius": 10})
    assert nearby.is_valid(), nearby.errors
    assert list(nearby.filter_queryset(Spot.objects.all())) == []

    polar = spot_serializers.NearbyQuerySerializer(data={"lat": 90, "lng": 0, "radius": 1})
    assert polar.is_valid(), polar.errors
    assert list(polar.filter_queryset(Spot.objects.none())) == []


def test_comment_view_visibility_and_reply_guard_branch_edges(auth_header):
    _, owner_id = auth_header
    public_trip = Trip.objects.create(creator_id=owner_id, title="Public", is_public=True)
    private_trip = Trip.objects.create(creator_id=owner_id, title="Private", is_public=False)

    admin_request = SimpleNamespace(user=SimpleNamespace(is_admin=True, id=None))
    anonymous_request = SimpleNamespace(user=SimpleNamespace(is_admin=False, id=None))
    assert set(comment_views._visible_trip_queryset(admin_request).values_list("id", flat=True)) == {
        public_trip.id,
        private_trip.id,
    }
    assert list(comment_views._visible_trip_queryset(anonymous_request).values_list("id", flat=True)) == [public_trip.id]

    request = RequestFactory().post("/api/content/comments")
    request.user = SimpleNamespace(id=owner_id, is_admin=False, is_authenticated=True)
    spot = Spot.objects.create(
        user_id=owner_id,
        title="Comment target",
        latitude=32.75,
        longitude=-97.33,
        category="food",
        is_public=False,
    )
    root = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=owner_id, body="root")
    nested_parent = Comment.objects.create(
        target_type=Comment.TARGET_SPOT,
        target_id=spot.id,
        user_id=owner_id,
        body="nested",
        parent=root,
    )
    nested_serializer = CommentSerializer(
        data={"targetType": "spot", "targetId": str(spot.id), "body": "reply", "parentId": str(nested_parent.id)}
    )
    assert nested_serializer.is_valid(), nested_serializer.errors
    with pytest.raises(ValidationError):
        comment_views._create_comment(request, nested_serializer)

    mismatched_parent = Comment.objects.create(
        target_type=Comment.TARGET_TRIP,
        target_id=uuid.uuid4(),
        user_id=owner_id,
        body="other target",
    )
    mismatch_serializer = CommentSerializer(
        data={"targetType": "spot", "targetId": str(spot.id), "body": "reply", "parentId": str(mismatched_parent.id)}
    )
    assert mismatch_serializer.is_valid(), mismatch_serializer.errors
    with pytest.raises(ValidationError):
        comment_views._create_comment(request, mismatch_serializer)


def test_runtime_and_network_parsing_remaining_branch_edges(monkeypatch):
    calls = []
    fake_management = ModuleType("django.core.management")
    fake_management.execute_from_command_line = lambda argv: calls.append(list(argv))
    monkeypatch.setitem(sys.modules, "django.core.management", fake_management)
    monkeypatch.setattr(sys, "argv", ["manage.py", "check"])
    manage_path = Path(__file__).resolve().parents[2] / "manage.py"

    runpy.run_path(str(manage_path), run_name="coverage_probe")
    runpy.run_path(str(manage_path), run_name="__main__")
    assert calls[0][0].endswith("manage.py")
    assert calls[0][1:] == ["check"]

    with override_settings(TRUSTED_PROXY_CIDRS="10.0.0.0/8,,bad-cidr"):
        assert len(legacy_rate_limit.RateLimitMiddleware._trusted_proxy_networks()) == 1
        assert len(ratelimit.RateLimitMiddleware._trusted_proxy_networks()) == 1

    monkeypatch.setenv("METRICS_ALLOWED_CIDRS", "127.0.0.1/32,,bad-cidr")
    assert len(_metrics_allowlist()) == 1
    assert content_auth._collect_roles({"role": 123}) == []


def test_feed_and_spot_view_helper_remaining_branch_edges():
    review_entry = SimpleNamespace(type="review", item=SimpleNamespace(user_id="review-user"))
    assert _collect_feed_user_ids([review_entry]) == {"review-user"}

    spot = Spot(
        user_id=uuid.uuid4(),
        title="Verified without address",
        latitude=32.75,
        longitude=-97.33,
        category="food",
    )
    spot_views._apply_verified_state(spot, {"source": "places", "city": "Fort Worth", "country": "US"})
    assert spot.address == ""
    assert spot.city == "Fort Worth"
