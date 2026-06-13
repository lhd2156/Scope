from __future__ import annotations

import uuid
from datetime import datetime, timezone as dt_timezone

import jwt
import pytest
from django.conf import settings
from django.http import Http404
from rest_framework.test import APIClient

from comments.models import Comment
from comments import views as comment_views
from spots.models import Spot
from trips.models import Trip

pytestmark = pytest.mark.django_db


def _client_for(user_id: uuid.UUID | str, roles: list[str] | None = None) -> APIClient:
    token = jwt.encode(
        {
            "sub": str(user_id),
            "roles": roles or ["user"],
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "exp": 4102444800,
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _spot(owner_id: uuid.UUID | str, **overrides) -> Spot:
    values = {
        "user_id": owner_id,
        "title": "Comment Spot",
        "description": "Good stop",
        "latitude": 1.0,
        "longitude": 2.0,
        "category": "scenic",
        "is_public": True,
        "verification_status": Spot.VERIFICATION_VERIFIED,
        "safety_status": Spot.SAFETY_CLEAN,
    }
    values.update(overrides)
    return Spot.objects.create(**values)


def test_comment_helper_formats_excerpt_timestamp_and_parent_payload():
    parent = Comment(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        target_type=Comment.TARGET_SPOT,
        target_id=uuid.uuid4(),
        body="Parent",
    )
    comment = Comment(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        target_type=Comment.TARGET_SPOT,
        target_id=uuid.uuid4(),
        body="  " + "word " * 80,
        parent=parent,
        created_at=datetime(2026, 1, 1, tzinfo=dt_timezone.utc),
    )

    assert comment_views._iso_timestamp(comment.created_at).endswith("Z")
    assert len(comment_views._body_excerpt(comment.body)) == 220

    payload = comment_views._event_payload(comment, {"targetTitle": "Spot", "targetOwnerUserId": "owner"}, [str(uuid.uuid4())])
    assert payload["parentCommentId"] == str(parent.id)
    assert payload["parentCommentUserId"] == str(parent.user_id)
    assert payload["bodyExcerpt"] == comment_views._body_excerpt(comment.body)


def test_comments_collection_get_returns_only_top_level_comments(auth_header):
    _, user_id = auth_header
    spot = _spot(user_id)
    parent = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=user_id, body="Parent")
    Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=user_id, body="Reply", parent=parent)

    response = APIClient().get(f"/api/content/comments/?targetType=spot&targetId={spot.id}")

    assert response.status_code == 200
    assert [item["body"] for item in response.json()["data"]] == ["Parent"]


def test_comment_reply_rejects_nested_reply(auth_header):
    _, user_id = auth_header
    spot = _spot(user_id)
    parent = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=user_id, body="Parent")
    child = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=user_id, body="Child", parent=parent)

    response = _client_for(user_id).post(f"/api/content/comments/{child.id}/replies/", {"body": "Nope"}, format="json")

    assert response.status_code == 400
    assert "Replies cannot be nested" in str(response.json())


def test_create_comment_rejects_parent_target_mismatch(auth_header):
    _, user_id = auth_header
    first = _spot(user_id, title="First")
    second = _spot(user_id, title="Second")
    parent = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=first.id, user_id=user_id, body="Parent")

    response = _client_for(user_id).post(
        "/api/content/comments/",
        {
            "targetType": "spot",
            "targetId": str(second.id),
            "parentId": str(parent.id),
            "body": "Wrong target",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "Reply target must match" in str(response.json())


def test_comment_detail_allows_owner_update_admin_delete_and_blocks_other_user(auth_header):
    _, owner_id = auth_header
    spot = _spot(owner_id)
    comment = Comment.objects.create(target_type=Comment.TARGET_SPOT, target_id=spot.id, user_id=owner_id, body="Original")

    blocked = _client_for(uuid.uuid4()).put(f"/api/content/comments/{comment.id}/", {"body": "Hack"}, format="json")
    assert blocked.status_code == 403

    updated = _client_for(owner_id).put(f"/api/content/comments/{comment.id}/", {"body": "Updated body"}, format="json")
    assert updated.status_code == 200
    comment.refresh_from_db()
    assert comment.body == "Updated body"

    deleted = _client_for(uuid.uuid4(), roles=["admin"]).delete(f"/api/content/comments/{comment.id}/")
    assert deleted.status_code == 200
    comment.refresh_from_db()
    assert comment.status == Comment.STATUS_DELETED
    assert comment.body == ""


def test_trip_target_context_requires_view_permission(auth_header):
    _, user_id = auth_header
    trip = Trip.objects.create(creator_id=uuid.uuid4(), title="Private trip", is_public=False)
    request = type("Request", (), {"user": type("User", (), {"id": uuid.UUID(user_id), "is_admin": False})()})()

    with pytest.raises(Http404):
        comment_views._target_context(request, Comment.TARGET_TRIP, trip.id)


def test_comment_create_hides_private_trip_for_non_member(auth_header):
    _, user_id = auth_header
    trip = Trip.objects.create(creator_id=uuid.uuid4(), title="Private trip", is_public=False)

    response = _client_for(user_id).post(
        "/api/content/comments/",
        {
            "targetType": "trip",
            "targetId": str(trip.id),
            "body": "This should not attach to another user's trip.",
        },
        format="json",
    )

    assert response.status_code == 404
    assert Comment.objects.count() == 0
