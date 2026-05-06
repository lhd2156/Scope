import uuid

from django.db import models


class Interaction(models.Model):
    """Append-only ledger of user<->spot interactions.

    Written by `POST /api/content/interactions`. The frontend logs events here
    (view, click, dismiss, save, share). A Kafka event (`interaction.recorded`)
    is fanned out so Intel can mirror the row into `intel.UserInteractions`
    and learn from it. Keep this table append-only so offline replay works.
    """

    INTERACTION_TYPES = [
        ('view', 'view'),
        ('dwell', 'dwell'),
        ('click', 'click'),
        ('like', 'like'),
        ('save', 'save'),
        ('visit', 'visit'),
        ('review', 'review'),
        ('share', 'share'),
        ('dismiss', 'dismiss'),
        ('hide', 'hide'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    spot_id = models.UUIDField(db_index=True)
    interaction_type = models.CharField(max_length=32, choices=INTERACTION_TYPES, db_index=True)
    # Free-form JSON (stored as text). Holds the surface ('explore' / 'detail' /
    # 'rec-card'), optional dwell_ms, search query, etc. Enforcing a schema here
    # would slow down iteration on new frontend telemetry.
    context = models.JSONField(null=True, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['user_id', 'occurred_at'], name='ix_interaction_user_time'),
            models.Index(fields=['spot_id', 'occurred_at'], name='ix_interaction_spot_time'),
        ]
