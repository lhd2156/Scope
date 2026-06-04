from __future__ import annotations

import re
from uuid import UUID

from rest_framework import serializers

from common.serializer_utils import copy_with_aliases
from comments.models import Comment, CommentMention

MENTION_PATTERN = re.compile(r'(?<!\w)@([a-zA-Z0-9_.-]{2,40})')
COMMENT_INPUT_ALIASES = {
    'target_type': 'targetType',
    'target_id': 'targetId',
    'parent_id': 'parentId',
    'mentioned_user_ids': 'mentionedUserIds',
}


class CommentSerializer(serializers.ModelSerializer):
    targetType = serializers.CharField(source='target_type')
    targetId = serializers.UUIDField(source='target_id')
    userId = serializers.UUIDField(source='user_id', read_only=True)
    parentId = serializers.UUIDField(source='parent_id', required=False, allow_null=True)
    mentionedUserIds = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
        allow_empty=True,
        max_length=20,
    )
    mentionedUsernames = serializers.SerializerMethodField()
    mentionUserIds = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Comment
        fields = [
            'id',
            'targetType',
            'targetId',
            'userId',
            'body',
            'parentId',
            'status',
            'mentionedUserIds',
            'mentionedUsernames',
            'mentionUserIds',
            'createdAt',
            'updatedAt',
        ]
        read_only_fields = ['id', 'userId', 'status', 'mentionedUsernames', 'mentionUserIds', 'createdAt', 'updatedAt']

    def to_internal_value(self, data):
        return super().to_internal_value(copy_with_aliases(data, COMMENT_INPUT_ALIASES))

    def validate_target_type(self, value: str) -> str:
        normalized = str(value or '').strip().lower()
        if normalized not in {Comment.TARGET_SPOT, Comment.TARGET_TRIP}:
            raise serializers.ValidationError('Comments can only target spots or trips.')
        return normalized

    def validate_body(self, value: str) -> str:
        normalized = str(value or '').strip()
        if not normalized:
            raise serializers.ValidationError('Comment body cannot be blank.')
        return normalized

    def validate_mentionedUserIds(self, value: list[UUID]) -> list[UUID]:
        seen: set[UUID] = set()
        deduped: list[UUID] = []
        for user_id in value:
            if user_id not in seen:
                seen.add(user_id)
                deduped.append(user_id)
        return deduped

    def get_mentionedUsernames(self, obj: Comment) -> list[str]:
        return list(dict.fromkeys(MENTION_PATTERN.findall(obj.body or '')))

    def get_mentionUserIds(self, obj: Comment) -> list[str]:
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('mentions')
        mentions = prefetched if prefetched is not None else obj.mentions.all()
        return [str(mention.mentioned_user_id) for mention in mentions]


def create_mentions(comment: Comment, mentioned_user_ids: list[UUID]) -> list[CommentMention]:
    rows: list[CommentMention] = []
    for user_id in dict.fromkeys(mentioned_user_ids):
        if str(user_id) == str(comment.user_id):
            continue
        mention, _ = CommentMention.objects.get_or_create(
            comment=comment,
            mentioned_user_id=user_id,
        )
        rows.append(mention)
    return rows
