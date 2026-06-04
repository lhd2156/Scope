from __future__ import annotations

import uuid
from datetime import datetime

import pytest

import comments.views as comment_views
from comments.models import Comment, CommentMention
from common.models import OutboxEvent
from spots.models import Spot

pytestmark = pytest.mark.django_db


@pytest.fixture
def published_events(monkeypatch):
    events: list[dict[str, object]] = []

    def capture(topic: str, data: dict, **kwargs):
        events.append({'topic': topic, 'data': data, 'event_id': kwargs.get('event_id')})

    monkeypatch.setattr(comment_views.producer, 'publish', capture)
    return events


def create_spot(owner_id: uuid.UUID | str, *, is_public: bool = True) -> Spot:
    return Spot.objects.create(
        user_id=owner_id,
        title='Fort Worth Rooftop',
        description='Golden hour views',
        latitude=32.75,
        longitude=-97.33,
        city='Fort Worth',
        country='US',
        category='scenic',
        vibe='calm',
        rating=4.8,
        is_public=is_public,
    )


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def test_comment_create_publishes_comment_and_mention_outbox_events(authenticated_client, auth_header, published_events):
    _, actor_user_id = auth_header
    owner_user_id = uuid.uuid4()
    mentioned_user_id = uuid.uuid4()
    spot = create_spot(owner_user_id)

    response = authenticated_client.post(
        '/api/content/comments/',
        {
            'targetType': 'spot',
            'targetId': str(spot.id),
            'body': 'Looping in @maya for this rooftop plan.',
            'mentionedUserIds': [str(mentioned_user_id), actor_user_id, str(mentioned_user_id)],
        },
        format='json',
    )

    assert response.status_code == 201
    comment_id = response.json()['data']['id']
    assert Comment.objects.filter(pk=comment_id, user_id=actor_user_id).exists()
    assert list(CommentMention.objects.values_list('mentioned_user_id', flat=True)) == [mentioned_user_id]

    assert [event['topic'] for event in published_events] == ['comment.created', 'mention.created']
    comment_payload = published_events[0]['data']
    mention_payload = published_events[1]['data']
    assert comment_payload == {
        'commentId': comment_id,
        'userId': actor_user_id,
        'targetType': 'spot',
        'targetId': str(spot.id),
        'targetTitle': spot.title,
        'targetOwnerUserId': str(owner_user_id),
        'parentCommentId': None,
        'parentCommentUserId': None,
        'mentionedUserIds': [str(mentioned_user_id)],
        'bodyExcerpt': 'Looping in @maya for this rooftop plan.',
        'occurredAt': comment_payload['occurredAt'],
    }
    assert mention_payload == comment_payload
    parse_timestamp(comment_payload['occurredAt'])

    outbox_events = list(OutboxEvent.objects.order_by('created_at'))
    assert len(outbox_events) == 2
    assert [event.topic for event in outbox_events] == ['comment.created', 'mention.created']
    assert [str(event.event_id) for event in outbox_events] == [event['event_id'] for event in published_events]
    assert all(event.status == OutboxEvent.STATUS_PUBLISHED for event in outbox_events)
    assert all(event.attempts == 1 for event in outbox_events)


def test_reply_comment_payload_targets_parent_author(authenticated_client, auth_header, published_events):
    _, actor_user_id = auth_header
    owner_user_id = uuid.uuid4()
    parent_user_id = uuid.uuid4()
    spot = create_spot(owner_user_id)
    parent = Comment.objects.create(
        target_type=Comment.TARGET_SPOT,
        target_id=spot.id,
        user_id=parent_user_id,
        body='I can make this route work.',
    )

    response = authenticated_client.post(
        f'/api/content/comments/{parent.id}/replies/',
        {'body': 'Perfect, I will bring the timing options.'},
        format='json',
    )

    assert response.status_code == 201
    reply_id = response.json()['data']['id']
    assert [event['topic'] for event in published_events] == ['comment.created']
    payload = published_events[0]['data']
    assert payload['commentId'] == reply_id
    assert payload['userId'] == actor_user_id
    assert payload['targetOwnerUserId'] == str(owner_user_id)
    assert payload['parentCommentId'] == str(parent.id)
    assert payload['parentCommentUserId'] == str(parent_user_id)
    assert payload['mentionedUserIds'] == []
    assert payload['bodyExcerpt'] == 'Perfect, I will bring the timing options.'
    assert OutboxEvent.objects.get().topic == 'comment.created'


def test_comment_create_rejects_private_spot_for_non_owner(authenticated_client, published_events):
    private_spot = create_spot(uuid.uuid4(), is_public=False)

    response = authenticated_client.post(
        '/api/content/comments/',
        {
            'targetType': 'spot',
            'targetId': str(private_spot.id),
            'body': 'This should not attach to private content.',
        },
        format='json',
    )

    assert response.status_code == 404
    assert Comment.objects.count() == 0
    assert OutboxEvent.objects.count() == 0
    assert published_events == []


def test_comment_create_blocks_unsafe_body_before_outbox_publish(authenticated_client, spot, published_events):
    response = authenticated_client.post(
        '/api/content/comments/',
        {
            'targetType': 'spot',
            'targetId': str(spot.id),
            'body': 'scope test blocked slur',
        },
        format='json',
    )

    assert response.status_code == 400
    assert Comment.objects.count() == 0
    assert OutboxEvent.objects.count() == 0
    assert published_events == []
