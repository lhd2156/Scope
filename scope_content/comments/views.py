from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError

from comments.models import Comment
from comments.serializers import CommentSerializer, create_mentions
from common.content_safety import evaluate_text_fields
from common.events import record_and_publish
from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from spots.models import Spot
from spots.querysets import visible_to_request
from trips.models import Trip
from trips.views import can_view_trip

producer = ScopeKafkaProducer()


def _iso_timestamp(value) -> str:
    return value.isoformat().replace('+00:00', 'Z')


def _body_excerpt(body: str) -> str:
    normalized = ' '.join(str(body or '').split())
    return normalized[:220]


def _check_comment_safety(body: str) -> None:
    result = evaluate_text_fields([('body', body)])
    if not result.clean:
        raise ValidationError({'body': ['This contains a blocked slur or hate term.']})


def _target_context(request, target_type: str, target_id):
    if target_type == Comment.TARGET_SPOT:
        spot = get_object_or_404(visible_to_request(Spot.objects.all(), request), pk=target_id)
        return {
            'targetTitle': spot.title,
            'targetOwnerUserId': str(spot.user_id),
        }

    trip = get_object_or_404(Trip, pk=target_id)
    if not can_view_trip(request.user, trip):
        raise PermissionDenied
    return {
        'targetTitle': trip.title,
        'targetOwnerUserId': str(trip.creator_id),
    }


def _comment_queryset():
    return Comment.objects.prefetch_related('mentions').filter(status=Comment.STATUS_ACTIVE)


def _event_payload(comment: Comment, context: dict, mentioned_user_ids: list[str] | None = None) -> dict:
    parent_user_id = str(comment.parent.user_id) if comment.parent_id and comment.parent else None
    return {
        'commentId': str(comment.id),
        'userId': str(comment.user_id),
        'targetType': comment.target_type,
        'targetId': str(comment.target_id),
        'targetTitle': context.get('targetTitle'),
        'targetOwnerUserId': context.get('targetOwnerUserId'),
        'parentCommentId': str(comment.parent_id) if comment.parent_id else None,
        'parentCommentUserId': parent_user_id,
        'mentionedUserIds': mentioned_user_ids or [],
        'bodyExcerpt': _body_excerpt(comment.body),
        'occurredAt': _iso_timestamp(comment.created_at or timezone.now()),
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticatedOrReadOnly])
def comments_collection(request):
    if request.method == 'GET':
        serializer = CommentSerializer(data={
            'targetType': request.query_params.get('targetType') or request.query_params.get('target_type'),
            'targetId': request.query_params.get('targetId') or request.query_params.get('target_id'),
            'body': 'placeholder',
        })
        serializer.is_valid(raise_exception=True)
        target_type = serializer.validated_data['target_type']
        target_id = serializer.validated_data['target_id']
        _target_context(request, target_type, target_id)
        comments = _comment_queryset().filter(target_type=target_type, target_id=target_id, parent__isnull=True)
        return data_response(CommentSerializer(comments, many=True).data)

    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return _create_comment(request, serializer)


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def comment_replies(request, pk):
    parent = get_object_or_404(_comment_queryset(), pk=pk)
    if parent.parent_id is not None:
        raise ValidationError({'parentId': ['Replies cannot be nested more than one level.']})

    payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
    payload['targetType'] = parent.target_type
    payload['targetId'] = str(parent.target_id)
    payload['parentId'] = str(parent.id)
    serializer = CommentSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    return _create_comment(request, serializer, parent=parent)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def comment_detail(request, pk):
    comment = get_object_or_404(_comment_queryset(), pk=pk)
    if str(comment.user_id) != str(request.user.id) and not getattr(request.user, 'is_admin', False):
        raise PermissionDenied

    if request.method == 'DELETE':
        comment.status = Comment.STATUS_DELETED
        comment.deleted_at = timezone.now()
        comment.body = ''
        comment.save(update_fields=['status', 'deleted_at', 'body', 'updated_at'])
        return data_response({'deleted': True})

    serializer = CommentSerializer(comment, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    body = serializer.validated_data.get('body', comment.body)
    _check_comment_safety(body)
    comment.body = body
    comment.save(update_fields=['body', 'updated_at'])
    return data_response(CommentSerializer(comment).data)


def _create_comment(request, serializer: CommentSerializer, parent: Comment | None = None):
    body = serializer.validated_data['body']
    target_type = serializer.validated_data['target_type']
    target_id = serializer.validated_data['target_id']
    parent_id = serializer.validated_data.get('parent_id')
    _check_comment_safety(body)
    context = _target_context(request, target_type, target_id)

    if parent is None and parent_id:
        parent = get_object_or_404(_comment_queryset(), pk=parent_id)
        if parent.parent_id is not None:
            raise ValidationError({'parentId': ['Replies cannot be nested more than one level.']})
        if parent.target_type != target_type or parent.target_id != target_id:
            raise ValidationError({'parentId': ['Reply target must match the parent comment.']})

    mentioned_user_ids = serializer.validated_data.get('mentionedUserIds') or []

    with transaction.atomic():
        comment = Comment.objects.create(
            target_type=target_type,
            target_id=target_id,
            user_id=request.user.id,
            body=body,
            parent=parent,
        )
        create_mentions(comment, mentioned_user_ids)

    mentioned_user_id_strings = [str(user_id) for user_id in mentioned_user_ids if str(user_id) != str(request.user.id)]
    record_and_publish(producer, 'comment.created', _event_payload(comment, context, mentioned_user_id_strings))
    if mentioned_user_id_strings:
        record_and_publish(producer, 'mention.created', _event_payload(comment, context, mentioned_user_id_strings))

    refreshed = _comment_queryset().get(pk=comment.pk)
    return data_response(CommentSerializer(refreshed).data, status_code=status.HTTP_201_CREATED)
