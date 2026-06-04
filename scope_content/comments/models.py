from __future__ import annotations

import uuid

from django.db import models


class Comment(models.Model):
    TARGET_SPOT = 'spot'
    TARGET_TRIP = 'trip'
    TARGET_CHOICES = [
        (TARGET_SPOT, TARGET_SPOT),
        (TARGET_TRIP, TARGET_TRIP),
    ]
    STATUS_ACTIVE = 'active'
    STATUS_DELETED = 'deleted'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, STATUS_ACTIVE),
        (STATUS_DELETED, STATUS_DELETED),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_type = models.CharField(max_length=20, choices=TARGET_CHOICES)
    target_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)
    body = models.TextField(max_length=1000)
    parent = models.ForeignKey('self', related_name='replies', on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['target_type', 'target_id', 'created_at'], name='comment_target_created_idx'),
            models.Index(fields=['parent', 'created_at'], name='comment_parent_created_idx'),
            models.Index(fields=['user_id', '-created_at'], name='comment_user_created_idx'),
        ]


class CommentMention(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    comment = models.ForeignKey(Comment, related_name='mentions', on_delete=models.CASCADE)
    mentioned_user_id = models.UUIDField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'mentioned_user_id')
        indexes = [
            models.Index(fields=['mentioned_user_id', '-created_at'], name='cm_user_created_idx'),
        ]
