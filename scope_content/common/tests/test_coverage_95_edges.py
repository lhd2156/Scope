from __future__ import annotations

import uuid
import json
import sys
from io import BytesIO
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from PIL import Image
from rest_framework.exceptions import ValidationError

from comments.models import Comment, CommentMention
from comments.serializers import CommentSerializer, create_mentions
from common import db_router
from common import exceptions as exception_module
from common import indexing
from common import kafka_producer
from common import telemetry
from common.middleware import rate_limit as legacy_rate_limit
from common.middleware import request_logging
from common.middleware import ratelimit
from common.pagination import FeedCursorPagination, StandardPageNumberPagination
from common.views import _client_ip, _health_payload, _metrics_allowlist, metrics_view
from photos.models import Photo
from photos import serializers as photo_serializers
from photos import views as photo_views
from spots import serializers as spot_serializers
from spots import views as spot_views
from spots.models import Spot
from trips.models import Like

pytestmark = pytest.mark.django_db


def _png_upload(name="photo.png") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (1, 1), color=(255, 255, 255)).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def test_validation_detail_flattening_handles_nested_empty_and_django_message_lists():
    details: list[dict[str, str]] = []
    exception_module._flatten_validation_detail({"items": [{"name": ["Missing"]}, []]}, details)

    assert {"field": "items[0].name", "message": "Missing"} in details
    assert {"field": "items[1]", "message": ""} in details

    extracted = exception_module._extract_validation_details(DjangoValidationError(["one", "two"]))
    assert extracted == [
        {"field": "non_field_errors", "message": "one"},
        {"field": "non_field_errors", "message": "two"},
    ]


def test_cursor_and_page_number_pagination_edges():
    class Item:
        def __init__(self, created_at):
            self.created_at = created_at

    first = Item(datetime(2026, 1, 3, tzinfo=timezone.utc))
    second = Item(datetime(2026, 1, 2, tzinfo=timezone.utc))
    third = Item(datetime(2026, 1, 1, tzinfo=timezone.utc))
    paginator = FeedCursorPagination()
    paginator.page_size = 2

    page = paginator.paginate_queryset(
        [third, first, second],
        SimpleNamespace(query_params={}),
    )

    assert page == [first, second]
    assert paginator.next_cursor == second.created_at.isoformat()
    response = paginator.get_paginated_response(["a", "b"])
    assert response.data["meta"]["nextCursor"] == second.created_at.isoformat()
    assert response.data["meta"]["previousCursor"] is None

    cursor_request = SimpleNamespace(query_params={"cursor": first.created_at.isoformat()})
    assert paginator.parse_cursor(cursor_request) == first.created_at
    assert paginator.previous_cursor == first.created_at.isoformat()

    with pytest.raises(ValidationError):
        paginator.parse_cursor(SimpleNamespace(query_params={"cursor": "not-a-date"}))

    page_number = StandardPageNumberPagination()
    page_number.page = SimpleNamespace(number=2, paginator=SimpleNamespace(count=40, num_pages=4))
    page_number.request = SimpleNamespace(query_params={"pageSize": "10"})
    assert page_number.get_paginated_response(["row"]).data == {
        "data": ["row"],
        "meta": {"page": 2, "pageSize": 10, "total": 40, "totalPages": 4},
    }


def test_request_logging_middleware_records_success_and_failure(monkeypatch):
    calls: list[tuple] = []
    monkeypatch.setattr(request_logging, "perf_counter", iter([1.0, 1.25, 3.0, 3.4]).__next__)
    monkeypatch.setattr(request_logging, "start_request_span", lambda method, path, correlation_id: ("span", method, path, correlation_id))
    monkeypatch.setattr(request_logging, "record_request_metrics", lambda *args: calls.append(("metrics", *args)))
    monkeypatch.setattr(request_logging, "finish_request_span", lambda *args, **kwargs: calls.append(("finish", args, kwargs)))

    request = RequestFactory().get("/api/content/spots/1")
    request.correlation_id = "trace-1"
    request.resolver_match = SimpleNamespace(route="/api/content/spots/<id>")
    response = request_logging.RequestLoggingMiddleware(lambda _request: HttpResponse("ok", status=202))(request)

    assert response.status_code == 202
    assert ("metrics", "GET", "/api/content/spots/<id>", 202, 0.25) in calls

    failing_request = RequestFactory().post("/api/content/spots/")
    failing_request.correlation_id = "trace-2"
    failing_request.resolver_match = None
    middleware = request_logging.RequestLoggingMiddleware(lambda _request: (_ for _ in ()).throw(RuntimeError("boom")))
    with pytest.raises(RuntimeError):
        middleware(failing_request)
    assert ("metrics", "POST", "/api/content/spots/", 500, 0.4) in calls


@override_settings(SERVICE_STARTED_AT=datetime(2026, 1, 1, tzinfo=timezone.utc), SERVICE_VERSION="9.9.9")
def test_metrics_allowlist_client_ip_and_health_payload(monkeypatch):
    monkeypatch.setenv("METRICS_ALLOWED_CIDRS", "127.0.0.0/8, bad-cidr ; ::1/128")
    assert len(_metrics_allowlist()) == 2

    forwarded = RequestFactory().get("/metrics", HTTP_X_FORWARDED_FOR="203.0.113.10, 10.0.0.1")
    assert _client_ip(forwarded) == "203.0.113.10"
    assert _client_ip(RequestFactory().get("/metrics", REMOTE_ADDR="127.0.0.1")) == "127.0.0.1"

    denied = metrics_view(RequestFactory().get("/metrics", REMOTE_ADDR="203.0.113.1"))
    assert denied.status_code == 403
    invalid = metrics_view(RequestFactory().get("/metrics", REMOTE_ADDR="not-an-ip"))
    assert invalid.status_code == 403

    monkeypatch.setattr("common.views.render_metrics", lambda: b"metrics")
    allowed = metrics_view(RequestFactory().get("/metrics", REMOTE_ADDR="127.0.0.1"))
    assert allowed.status_code == 200
    assert allowed.content == b"metrics"
    assert _health_payload("healthy")["version"] == "9.9.9"


def test_spot_payload_list_and_verification_helpers():
    assert spot_views._coerce_json_object({"title": "A"}) == {"title": "A"}
    assert spot_views._coerce_json_object('{"title":"A"}') == {"title": "A"}
    for raw in ("not-json", "[1,2]", None):
        with pytest.raises(ValidationError):
            spot_views._coerce_json_object(raw)

    plain_request = SimpleNamespace(data={"title": "A", "photos": ["drop"], "captions": ["drop"]})
    assert spot_views._extract_spot_payload(plain_request) == {"title": "A"}

    spot_request = SimpleNamespace(data={"spot": '{"title":"Wrapped"}'})
    assert spot_views._extract_spot_payload(spot_request) == {"title": "Wrapped"}

    assert spot_views._extract_list_field(SimpleNamespace(data={"captions": ["a", 2]}), "captions") == ["a", "2"]
    assert spot_views._extract_list_field(SimpleNamespace(data={"captions": '["a","b"]'}), "captions") == ["a", "b"]
    assert spot_views._extract_list_field(SimpleNamespace(data={"captions": "plain"}), "captions") == ["plain"]
    assert spot_views._extract_list_field(SimpleNamespace(data={}), "captions") == []

    payload = spot_views._build_verification_payload(
        {
            "title": "Cafe",
            "postal_code": "76102",
            "provider_place_id": "provider-1",
            "latitude": 1,
            "longitude": 2,
        }
    )
    assert payload["postalCode"] == "76102"
    assert payload["providerPlaceId"] == "provider-1"

    spot = Spot(title="Original", address="", city="", country="", latitude=1, longitude=2, category="food", vibe="chill")
    spot_views._apply_verified_state(
        spot,
        {
            "source": "google",
            "providerPlaceId": "pid",
            "providerPlaceName": "Verified Name",
            "providerPlaceAddress": "123 Road",
            "city": "Fort Worth",
            "country": "US",
            "postalCode": "76102",
            "distanceMeters": "bad",
        },
    )
    assert spot.verification_status == Spot.VERIFICATION_VERIFIED
    assert spot.title == "Original"
    assert spot.provider_place_name == "Verified Name"
    assert spot.verification_distance_meters is None

    spot_views._apply_unverified_state(spot)
    assert spot.verification_status == Spot.VERIFICATION_UNVERIFIED
    assert spot.provider_place_id == ""

    error = spot_views._verification_error({"reason": "Too far", "candidates": [1, 2, 3, 4]})
    assert error.detail["location"][0] == "Too far"
    assert [str(item) for item in error.detail["candidates"]] == ["1", "2", "3"]
    assert spot_views._sanitize_fts_term(' "coffee" & drop ') == "coffee  drop"


def test_apply_search_selects_backend_specific_paths(monkeypatch):
    calls: list[tuple] = []

    class FakeQuerySet:
        def extra(self, **kwargs):
            calls.append(("extra", kwargs))
            return self

        def filter(self, *args, **kwargs):
            calls.append(("filter", args, kwargs))
            return self

    queryset = FakeQuerySet()
    monkeypatch.setattr(spot_views.connection, "vendor", "microsoft")
    monkeypatch.setenv("CONTENT_MSSQL_FULLTEXT_ENABLED", "true")
    spot_views._MSSQL_FULLTEXT_AVAILABLE = None
    assert spot_views._apply_search(queryset, "coffee!") is queryset
    assert calls[-1][0] == "extra"

    monkeypatch.setattr(spot_views.connection, "vendor", "postgresql")
    assert spot_views._apply_search(queryset, "parks") is queryset
    assert calls[-1][0] == "extra"

    monkeypatch.setattr(spot_views.connection, "vendor", "sqlite")
    assert spot_views._apply_search(queryset, "tacos") is queryset
    assert calls[-1][0] == "filter"
    assert spot_views._apply_search(queryset, "!!!") is queryset


def test_spot_serializer_and_nearby_query_helper_edges():
    serializer = spot_serializers.SpotSerializer()
    assert serializer.to_internal_value(
        {
            "title": "Cafe",
            "description": "Nice",
            "latitude": 1,
            "longitude": 2,
            "category": "food",
            "vibe": "chill",
            "visitedAt": "2026-01-01",
            "isPublic": False,
            "postal_code": "76102",
        }
    )
    assert serializer.validate_description("  desc ") == "desc"
    assert serializer.validate_address("  addr ") == "addr"
    assert serializer.validate_city("  city ") == "city"
    assert serializer.validate_country("  us ") == "us"
    assert serializer.validate_postal_code("  76102 ") == "76102"
    assert serializer.validate_postalCode("  76102 ") == "76102"
    assert serializer.validate_vibe(" chill ") == "chill"
    assert serializer.validate_pillars(None) == []
    assert serializer.validate_pillars(["", "hidden-gem"]) == ["hidden-gem"]
    assert serializer.validate_pillars(["hidden-gem", "hidden-gem", "photo-worthy"]) == ["hidden-gem", "photo-worthy"]
    assert serializer.validate_rating(None) is None

    for method, value in [
        (serializer.validate_title, " "),
        (serializer.validate_pillars, "bad"),
        (serializer.validate_pillars, ["nope"]),
        (
            serializer.validate_pillars,
            ["hidden-gem", "photo-worthy", "date-night", "group-friendly", "solo-friendly"],
        ),
        (serializer.validate_latitude, 91),
        (serializer.validate_longitude, 181),
        (serializer.validate_rating, Decimal("6.0")),
    ]:
        with pytest.raises(Exception):
            method(value)

    photo = SimpleNamespace(storage_url="storage", thumbnail_url="thumb", caption="cap", id="p1")
    review = SimpleNamespace(id="r1", rating="4.5", comment="nice", user_id="user-1")
    obj = SimpleNamespace(
        list_photo_storage_url=None,
        list_photo_thumbnail_url="annotated-thumb",
        photos=SimpleNamespace(order_by=lambda *_args: [photo]),
        reviews=SimpleNamespace(order_by=lambda *_args: [review] * 6),
    )
    assert serializer.get_photo_url(obj) is None
    assert spot_serializers.AppendixBSpotListItemSerializer.get_photoUrl(obj) == "annotated-thumb"
    delattr(obj, "list_photo_storage_url")
    delattr(obj, "list_photo_thumbnail_url")
    assert serializer.get_photo_url(obj) == "storage"
    assert spot_serializers.SpotDetailSerializer().get_photos(obj)[0]["storageUrl"] == "storage"
    assert len(spot_serializers.SpotDetailSerializer().get_reviews(obj)) == 5
    assert spot_serializers.AppendixBSpotListItemSerializer.get_photoUrl(
        SimpleNamespace(photos=SimpleNamespace(order_by=lambda *_args: []))
    ) is None

    nearby = spot_serializers.NearbyQuerySerializer()
    for field_validator, value in [(nearby.validate_lng, 181), (nearby.validate_radius, 0)]:
        with pytest.raises(Exception):
            field_validator(value)
    assert nearby._longitude_bounds(90, 0, 10) is None
    assert nearby._longitude_bounds(0, 179, 300)[0] > nearby._longitude_bounds(0, 179, 300)[1]
    assert nearby._longitude_bounds(0, 0, 25000) is None
    assert nearby._longitude_bounds(0, -179, 300)[0] > nearby._longitude_bounds(0, -179, 300)[1]
    assert nearby._latitude_delta(111) == 1
    assert nearby._distance_km(0, 0, 0, 1) > 100

    class EmptyNearbyQuerySet:
        def filter(self, *args, **kwargs):
            return self

        def only(self, *args):
            return []

        def none(self):
            return "none"

    nearby = spot_serializers.NearbyQuerySerializer(data={"lat": 0, "lng": 0, "radius": 1})
    assert nearby.is_valid(), nearby.errors
    assert nearby.filter_queryset(EmptyNearbyQuerySet()) == "none"


def test_spot_api_branches_for_compose_update_permissions_and_likes(authenticated_client, auth_header, monkeypatch):
    _, user_id = auth_header
    monkeypatch.setattr(spot_views, "index_spot", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(spot_views, "delete_spot", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(spot_views, "invalidate_cache_namespaces", lambda *_args, **_kwargs: None)
    published: list[tuple[str, dict]] = []
    monkeypatch.setattr(spot_views, "record_and_publish", lambda _producer, topic, payload: published.append((topic, payload)))

    private_response = authenticated_client.post(
        "/api/content/spots/compose",
        {
            "title": "Quiet Patio",
            "description": "Small shaded tables",
            "latitude": 32.7,
            "longitude": -97.3,
            "category": "food",
            "vibe": "calm",
            "pillars": ["hidden-gem"],
            "isPublic": False,
        },
        format="json",
    )

    assert private_response.status_code == 201, private_response.json()
    private_spot = Spot.objects.get(title="Quiet Patio")
    assert private_spot.is_public is False
    assert private_spot.verification_status == Spot.VERIFICATION_UNVERIFIED

    no_pillars = authenticated_client.post(
        "/api/content/spots/compose",
        {
            "title": "No Pillars",
            "description": "Missing vibe selectors",
            "latitude": 32.7,
            "longitude": -97.3,
            "category": "food",
            "vibe": "calm",
            "pillars": [],
            "isPublic": False,
        },
        format="json",
    )
    assert no_pillars.status_code == 400
    assert "Choose at least one" in str(no_pillars.json())

    no_photo = authenticated_client.post(
        "/api/content/spots/compose",
        {
            "title": "Needs Photo",
            "description": "Public without evidence",
            "latitude": 32.7,
            "longitude": -97.3,
            "category": "food",
            "vibe": "calm",
            "pillars": ["hidden-gem"],
            "isPublic": True,
        },
        format="json",
    )
    assert no_photo.status_code == 400
    assert "Public spots need" in str(no_photo.json())

    monkeypatch.setattr(
        spot_views,
        "verify_spot_place",
        lambda *_args, **_kwargs: {"verified": False, "reason": "Too far away", "candidates": [{"name": "Nearby"}]},
    )
    rejected = authenticated_client.post(
        "/api/content/spots/compose",
        {
            "spot": json.dumps(
                {
                    "title": "Unverified",
                    "description": "Photo exists but place fails",
                    "latitude": 32.7,
                    "longitude": -97.3,
                    "category": "food",
                    "vibe": "calm",
                    "pillars": ["hidden-gem"],
                    "isPublic": True,
                }
            ),
            "photos": [_png_upload("reject.png")],
        },
        format="multipart",
    )
    assert rejected.status_code == 400
    assert "Too far away" in str(rejected.json())

    publish_attempt = authenticated_client.put(
        f"/api/content/spots/{private_spot.id}",
        {
            "title": "Quiet Patio",
            "description": "Small shaded tables",
            "latitude": 32.7,
            "longitude": -97.3,
            "category": "food",
            "vibe": "calm",
            "pillars": ["hidden-gem"],
            "is_public": True,
        },
        format="json",
    )
    assert publish_attempt.status_code == 400
    private_spot.refresh_from_db()
    assert private_spot.is_public is False
    assert private_spot.verification_status == Spot.VERIFICATION_REJECTED

    other_spot = Spot.objects.create(
        user_id=uuid.uuid4(),
        title="Other Owner",
        description="Visible but locked",
        latitude=1,
        longitude=2,
        category="food",
        is_public=True,
    )
    assert authenticated_client.delete(f"/api/content/spots/{other_spot.id}").status_code == 403

    liked_once = authenticated_client.post(f"/api/content/spots/{other_spot.id}/like")
    liked_twice = authenticated_client.post(f"/api/content/spots/{other_spot.id}/like")
    unliked = authenticated_client.delete(f"/api/content/spots/{other_spot.id}/like")
    assert liked_once.status_code == 201
    assert liked_once.json()["data"]["liked"] is True
    assert liked_twice.status_code == 200
    assert liked_twice.json()["data"]["liked"] is True
    assert unliked.status_code == 200
    assert Like.objects.filter(spot=other_spot, user_id=user_id).count() == 0
    assert any(topic == "spot.liked" for topic, _payload in published)


def test_comment_serializer_mentions_aliases_and_validation_edges():
    first_user = uuid.uuid4()
    second_user = uuid.uuid4()
    comment_id = uuid.uuid4()
    serializer = CommentSerializer(
        data={
            "target_type": "spot",
            "target_id": comment_id,
            "body": " hello @alpha @alpha @beta-user ",
            "mentioned_user_ids": [first_user, first_user, second_user],
        }
    )

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["target_type"] == Comment.TARGET_SPOT
    assert serializer.validated_data["body"] == "hello @alpha @alpha @beta-user"
    assert serializer.validated_data["mentionedUserIds"] == [first_user, second_user]

    with pytest.raises(Exception):
        serializer.validate_target_type("photo")
    blank_body = CommentSerializer(data={"targetType": "spot", "targetId": comment_id, "body": " "})
    assert blank_body.is_valid() is False

    comment = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=comment_id, user_id=first_user, body="@alpha @alpha")
    mentions = create_mentions(comment, [first_user, second_user, second_user])
    assert len(mentions) == 1
    assert CommentMention.objects.filter(comment=comment, mentioned_user_id=second_user).exists()
    assert serializer.get_mentionedUsernames(comment) == ["alpha"]
    assert serializer.get_mentionUserIds(comment) == [str(second_user)]

    prefetched = Comment(target_type=Comment.TARGET_SPOT, target_id=comment_id, user_id=first_user, body="prefetched")
    prefetched._prefetched_objects_cache = {"mentions": [SimpleNamespace(mentioned_user_id=second_user)]}
    assert serializer.get_mentionUserIds(prefetched) == [str(second_user)]


def test_photo_views_async_permissions_detail_and_presigned(authenticated_client, auth_header, monkeypatch, settings):
    _, user_id = auth_header
    monkeypatch.setenv("PHOTO_UPLOAD_ASYNC_THUMBNAILS", "true")
    settings.KAFKA_ENABLED = True
    events: list[tuple[str, dict]] = []

    class FakeStorage:
        def store_original(self, uploaded_file):
            return {"storage_key": "photos/original.png", "storage_url": "https://cdn.example/original.png"}

        def store(self, uploaded_file):
            return {
                "storage_key": "photos/sync.png",
                "storage_url": "https://cdn.example/sync.png",
                "thumbnail_url": "https://cdn.example/sync-thumb.png",
            }

        def presigned_upload_url(self, key):
            return f"https://upload.example/{key}"

    monkeypatch.setattr(photo_views, "S3StorageService", lambda: FakeStorage())
    monkeypatch.setattr(photo_views.producer, "publish", lambda topic, payload: events.append((topic, payload)))
    monkeypatch.setattr(photo_views, "invalidate_cache_namespaces", lambda *_args, **_kwargs: None)

    owned_spot = Spot.objects.create(
        user_id=user_id,
        title="Owned",
        description="ok",
        latitude=1,
        longitude=2,
        category="food",
        is_public=False,
    )
    async_response = authenticated_client.post(
        "/api/content/photos/upload",
        {"spot_id": str(owned_spot.id), "file": _png_upload("async.png"), "caption": " cover "},
    )

    assert async_response.status_code == 201, async_response.json()
    assert async_response.json()["data"]["thumbnail_url"] == ""
    assert [topic for topic, _payload in events] == ["photo.thumbnail.requested", "photo.uploaded"]

    other_public = Spot.objects.create(
        user_id=uuid.uuid4(),
        title="Public Other",
        description="ok",
        latitude=1,
        longitude=2,
        category="food",
        is_public=True,
    )
    other_private = Spot.objects.create(
        user_id=uuid.uuid4(),
        title="Private Other",
        description="ok",
        latitude=1,
        longitude=2,
        category="food",
        is_public=False,
    )
    assert authenticated_client.post("/api/content/photos/upload", {"spot_id": str(other_public.id), "file": _png_upload("pub.png")}).status_code == 403
    assert authenticated_client.post("/api/content/photos/upload", {"spot_id": str(other_private.id), "file": _png_upload("priv.png")}).status_code == 404

    presigned = authenticated_client.get("/api/content/photos/presigned-url")
    assert presigned.status_code == 200
    assert presigned.json()["data"]["enabled"] is True

    photo = Photo.objects.create(
        spot=owned_spot,
        user_id=user_id,
        storage_key="photos/original.png",
        storage_url="https://cdn.example/original.png",
        caption="old",
    )
    updated = authenticated_client.put(f"/api/content/photos/{photo.id}", {"caption": " new "}, format="json")
    assert updated.status_code == 200
    assert updated.json()["data"]["caption"] == "new"

    stranger_photo = Photo.objects.create(
        spot=owned_spot,
        user_id=uuid.uuid4(),
        storage_key="photos/other.png",
        storage_url="https://cdn.example/other.png",
    )
    assert authenticated_client.delete(f"/api/content/photos/{stranger_photo.id}").status_code == 403
    assert authenticated_client.delete(f"/api/content/photos/{photo.id}").status_code == 200


def test_ratelimit_redis_rules_fallback_and_headers(monkeypatch):
    request_factory = RequestFactory()
    middleware = ratelimit.RateLimitMiddleware(lambda _request: HttpResponse("ok"))

    assert middleware(request_factory.get("/api/not-content")).status_code == 200
    monkeypatch.setenv("RATE_LIMIT_REDIS_URL", "redis://env-cache")
    assert middleware._redis_url() == "redis://env-cache"
    monkeypatch.delenv("RATE_LIMIT_REDIS_URL")

    with override_settings(CACHES={"default": {"BACKEND": "django_redis.cache.RedisCache", "LOCATION": "redis://settings-cache"}}):
        assert middleware._redis_url() == "redis://settings-cache"
    with override_settings(CACHES={"default": {"BACKEND": "locmem", "LOCATION": "memory"}}):
        assert middleware._redis_url() is None

    auth_request = request_factory.post("/api/content/auth/login", REMOTE_ADDR="198.51.100.1")
    search_request = request_factory.get("/api/content/search", REMOTE_ADDR="198.51.100.1")
    upload_request = request_factory.post("/api/content/photos/upload", REMOTE_ADDR="198.51.100.1")
    upload_request.user = SimpleNamespace(id="user-1")
    comments_request = request_factory.delete("/api/content/comments/1", REMOTE_ADDR="198.51.100.1")
    comments_request.user = SimpleNamespace(id=None)
    assert len(middleware._rules_for_request(auth_request)) == 2
    assert len(middleware._rules_for_request(search_request)) == 2
    assert middleware._rules_for_request(upload_request)[-1][0] == "rl:upload:user-1"
    assert middleware._rules_for_request(comments_request)[-1][0] == "rl:comments:198.51.100.1"

    class FakePipe:
        def __init__(self, results=None, error: Exception | None = None):
            self.results = results or [0, 0, 1, 1]
            self.error = error
            self.calls: list[tuple] = []

        def zremrangebyscore(self, *args):
            self.calls.append(("zremrangebyscore", args))
            return self

        def zcard(self, *args):
            self.calls.append(("zcard", args))
            return self

        def zadd(self, *args):
            self.calls.append(("zadd", args))
            return self

        def expire(self, *args):
            self.calls.append(("expire", args))
            return self

        def execute(self):
            if self.error:
                raise self.error
            return self.results

    class FakeClient:
        def __init__(self, pipe):
            self._pipe = pipe

        def pipeline(self):
            return self._pipe

    ok_response, ok_headers = middleware._enforce_rule(FakeClient(FakePipe([0, 1, 1, 1])), "key", 3, 60, search_request)
    assert ok_response is None
    assert ok_headers["X-RateLimit-Remaining"] == "1"

    limited_response, limited_headers = middleware._enforce_rule(FakeClient(FakePipe([0, 3, 1, 1])), "key", 3, 60, search_request)
    assert limited_response.status_code == 429
    assert limited_headers == {}

    ratelimit._FALLBACK_BUCKETS.clear()
    fallback_request = request_factory.get("/api/content/search", REMOTE_ADDR="198.51.100.2")
    monkeypatch.setattr(ratelimit.time, "time", iter([100.0, 100.1, 100.2, 100.3, 100.4]).__next__)
    fallback_response, _headers = middleware._enforce_rule(FakeClient(FakePipe(error=RuntimeError("redis down"))), "fallback", 1, 60, fallback_request)
    assert fallback_response is None
    blocked, _headers = middleware._enforce_fallback("fallback", 1, 60, fallback_request)
    assert blocked.status_code == 429

    ratelimit._FALLBACK_BUCKETS.clear()
    monkeypatch.setattr(middleware, "_get_redis", lambda: None)
    content_response = middleware(request_factory.get("/api/content/health", REMOTE_ADDR="198.51.100.3"))
    assert content_response["X-RateLimit-Limit"]


def test_indexing_router_and_list_filter_remaining_edges(monkeypatch):
    class FakeClient:
        def __init__(self, fail=False):
            self.fail = fail
            self.indexed: list[dict] = []
            self.deleted: list[dict] = []

        def index(self, **kwargs):
            if self.fail:
                raise RuntimeError("index failed")
            self.indexed.append(kwargs)

        def options(self, **kwargs):
            self.option_kwargs = kwargs
            return self

        def delete(self, **kwargs):
            if self.fail:
                raise RuntimeError("delete failed")
            self.deleted.append(kwargs)

    client = FakeClient()
    monkeypatch.setattr(indexing, "get_es_client", lambda: client)
    reviews = SimpleNamespace(aggregate=lambda **_kwargs: {"avg_rating": None, "review_count": 0})
    public_spot = SimpleNamespace(
        id="spot-1",
        is_public=True,
        reviews=reviews,
        pillars=["hidden-gem"],
        name="Name",
        title="Title",
        description="Desc",
        category="food",
        vibe="calm",
        city="Fort Worth",
        verification_status="verified",
        safety_status="clean",
        creator_id=None,
        user_id="owner-1",
        rating="4.5",
        latitude=1,
        longitude=2,
        photos=[SimpleNamespace(thumbnail_url="", storage_url="https://photos.example.com/title.jpg")],
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    indexing.index_spot(public_spot)
    assert client.indexed[-1]["document"]["location"] == {"lat": 1.0, "lon": 2.0}
    assert client.indexed[-1]["document"]["photo_url"] == "https://photos.example.com/title.jpg"

    private_spot = SimpleNamespace(id="spot-2", is_public=False)
    indexing.index_spot(private_spot)
    assert client.deleted[-1]["id"] == "spot-2"

    review = SimpleNamespace(
        id="review-1",
        spot=public_spot,
        spot_id="spot-1",
        user_id="user-1",
        text="Nice",
        rating="5",
        sentiment_score=None,
        created_at=datetime(2026, 1, 3, tzinfo=timezone.utc),
    )
    indexing.index_review(review)
    indexing.index_review(SimpleNamespace(id="review-2", spot=private_spot, spot_id="spot-2"))
    assert any(row["index"] == "scope-reviews" for row in client.indexed)
    assert client.deleted[-1]["id"] == "review-2"

    trip = SimpleNamespace(
        id="trip-1",
        is_public=True,
        title="Trip",
        description="Drive",
        creator_id="owner-1",
        member_count=None,
        spot_count=2,
        members=SimpleNamespace(count=lambda: 3),
        trip_spots=SimpleNamespace(count=lambda: 2),
        created_at=datetime(2026, 1, 4, tzinfo=timezone.utc),
    )
    indexing.index_trip(trip)
    indexing.index_trip(SimpleNamespace(id="trip-2", is_public=False))
    assert any(row["index"] == "scope-trips" for row in client.indexed)
    assert client.deleted[-1]["id"] == "trip-2"

    failing_client = FakeClient(fail=True)
    monkeypatch.setattr(indexing, "get_es_client", lambda: failing_client)
    indexing._safe_index("idx", "id", {})
    indexing._safe_delete("idx", "id")

    router = db_router.PrimaryReplicaRouter()
    with override_settings(DATABASES={"default": {}, "replica": {}}):
        first = SimpleNamespace(_state=SimpleNamespace(db="default"))
        second = SimpleNamespace(_state=SimpleNamespace(db="replica"))
        unknown = SimpleNamespace(_state=SimpleNamespace(db="archive"))
        assert router.allow_relation(first, second) is True
        assert router.allow_relation(first, unknown) is None
        assert list(db_router.iter_replica_aliases()) == ["replica"]

    calls: list[str] = []
    view = spot_views.SpotListCreateView()
    view.request = SimpleNamespace(query_params={"q": "coffee"}, user=SimpleNamespace(is_authenticated=False, is_admin=False))
    monkeypatch.setattr(spot_views, "_apply_search", lambda queryset, term: calls.append(term) or queryset)
    assert list(view.get_queryset()) == []
    assert calls == ["coffee"]


def test_serializer_telemetry_kafka_and_legacy_rate_limit_edges(monkeypatch, settings):
    assert photo_serializers._sniff_image_mime(object()) is None
    assert photo_serializers._sniff_image_mime(BytesIO(b"RIFFxxxxWEBPmore")) == "image/webp"
    assert photo_serializers._sniff_image_mime(BytesIO(b"not-an-image")) is None

    upload_serializer = photo_serializers.PhotoUploadSerializer()
    settings.MAX_UPLOAD_BYTES = 4
    with pytest.raises(Exception):
        upload_serializer.validate_file(SimpleNamespace(size=5))
    with pytest.raises(Exception):
        upload_serializer.validate_file(SimpleNamespace(size=1, read=lambda *_args: b"bad", seek=lambda *_args: None))
    with pytest.raises(Exception):
        upload_serializer.validate_spot_id(uuid.uuid4())
    assert upload_serializer.validate_caption(" cap ") == "cap"

    legacy = legacy_rate_limit.RateLimitMiddleware(lambda _request: HttpResponse("legacy"))
    request = RequestFactory().post(
        "/api/content/comments",
        REMOTE_ADDR="198.51.100.9",
        HTTP_X_FORWARDED_FOR="203.0.113.9, 198.51.100.9",
    )
    request.user = SimpleNamespace(id="user-legacy")
    assert legacy._client_ip(request) == "203.0.113.9"
    assert legacy._upload_identity(request, "198.51.100.9") == "user-legacy"
    assert legacy._limits_for_request(request)[-1][0] == "comments:user-legacy"

    monkeypatch.setattr(legacy, "_limits_for_request", lambda _request: [("a", 1), ("b", 1)])
    calls: list[str] = []

    def enforce(_request, key, _limit):
        calls.append(key)
        return None

    monkeypatch.setattr(legacy, "_enforce_limit", enforce)
    assert legacy(RequestFactory().get("/api/content/health")).content == b"legacy"
    assert calls == ["a", "b"]

    limited = legacy_rate_limit.RateLimitMiddleware(lambda _request: HttpResponse("unused"))
    monkeypatch.setattr(limited, "_limits_for_request", lambda _request: [("blocked", 1)])
    monkeypatch.setattr(limited, "_enforce_limit", lambda _request, _key, _limit: legacy._build_limited_response(_request, 7))
    blocked_response = limited(RequestFactory().get("/api/content/health"))
    assert blocked_response.status_code == 429
    assert blocked_response["Retry-After"] == "7"

    status_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(kafka_producer, "record_kafka_produced", lambda topic, status="ok": status_calls.append((topic, status)))

    class FakeFuture:
        def __init__(self):
            self.errback = None

        def add_errback(self, callback):
            self.errback = callback

    class FakeProducer:
        def __init__(self):
            self.future = FakeFuture()
            self.flushed = None

        def send(self, _topic, _event):
            return self.future

        def flush(self, timeout=None):
            self.flushed = timeout

    producer = kafka_producer.ScopeKafkaProducer()
    producer._producer = FakeProducer()
    producer.publish("topic.name", {"id": 1}, event_id="event-1")
    producer._producer.future.errback(RuntimeError("send failed"))
    producer.flush(timeout=3.5)
    assert status_calls == [("topic.name", "ok"), ("topic.name", "error")]
    assert producer._producer.flushed == 3.5

    monkeypatch.setattr(telemetry, "_INITIALIZED", False)
    monkeypatch.setattr(telemetry.trace, "set_tracer_provider", lambda _provider: None)
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    assert telemetry._trace_exporter_endpoint() is None
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318")
    assert telemetry._trace_exporter_endpoint() == "http://collector:4318/v1/traces"
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318/v1/traces")
    assert telemetry._trace_exporter_endpoint() == "http://collector:4318/v1/traces"
    telemetry.record_kafka_consumer_lag("topic.name", 2, "group", -4)
    telemetry.record_request_metrics("GET", "api/content", 200, 0.01)
    telemetry.record_service_health("content", healthy=False)
    assert telemetry.normalize_route(None) == "/"
    assert telemetry.normalize_route("api/content") == "/api/content"


def test_new_ratelimit_redis_import_cache_and_fallback_edges(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_REDIS_URL", "redis://cache")
    fake_module = SimpleNamespace(from_url=lambda url: f"client:{url}")
    monkeypatch.setitem(sys.modules, "redis", fake_module)
    middleware = ratelimit.RateLimitMiddleware(lambda _request: HttpResponse("ok"))
    assert middleware._get_redis() == "client:redis://cache"
    assert middleware._get_redis() == "client:redis://cache"

    failing = ratelimit.RateLimitMiddleware(lambda _request: HttpResponse("ok"))
    monkeypatch.setitem(sys.modules, "redis", SimpleNamespace(from_url=lambda _url: (_ for _ in ()).throw(RuntimeError("boom"))))
    assert failing._get_redis() is None
    assert failing._get_redis() is None

    request = RequestFactory().get("/api/content/health", REMOTE_ADDR="198.51.100.10", HTTP_X_FORWARDED_FOR="203.0.113.10, 198.51.100.10")
    assert ratelimit.RateLimitMiddleware._get_client_ip(request) == "203.0.113.10"

    ratelimit._FALLBACK_BUCKETS.clear()
    bucket = ratelimit._FALLBACK_BUCKETS["stale"]
    bucket.append(1.0)
    monkeypatch.setattr(ratelimit.time, "time", lambda: 100.0)
    response, headers = middleware._enforce_fallback("stale", 2, 60, request)
    assert response is None
    assert headers["X-RateLimit-Remaining"] == "1"
    assert list(ratelimit._FALLBACK_BUCKETS["stale"]) == [100.0]
