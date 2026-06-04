import uuid

from django.db import models

from spots.models import Spot


class Trip(models.Model):
    STATUS_CHOICES = [('planning','planning'),('active','active'),('completed','completed'),('cancelled','cancelled')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator_id = models.UUIDField()
    title = models.CharField(max_length=200)
    destination = models.CharField(max_length=300, blank=True)
    description = models.TextField(max_length=2000, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planning')
    is_public = models.BooleanField(default=True)
    cover_photo_url = models.URLField(max_length=1000, blank=True)
    share_token = models.UUIDField(null=True, blank=True, unique=True)
    share_created_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [
            # Public trips feed (ORDER BY created_at DESC WHERE is_public).
            models.Index(fields=['is_public', '-created_at'], name='trip_ispub_created_idx'),
            # Creator lookups; complements the FK-implied index on TripMember.user_id
            # for the "trips I own or am a member of" union query.
            models.Index(fields=['creator_id', '-created_at'], name='trip_creator_created_idx'),
        ]
class TripSpot(models.Model):
    SOURCE_CHOICES = [('saved_spot','saved_spot'),('planner_generated','planner_generated')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, related_name='trip_spots', on_delete=models.CASCADE)
    spot = models.ForeignKey(Spot, related_name='trip_references', on_delete=models.CASCADE)
    day_number = models.IntegerField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    notes = models.CharField(max_length=500, blank=True)
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default='saved_spot')
    class Meta:
        ordering = ['day_number', 'sort_order', 'id']
        unique_together = ('trip', 'spot')
class TripMember(models.Model):
    ROLE_CHOICES = [('owner','owner'),('editor','editor'),('viewer','viewer')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, related_name='members', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    joined_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('trip', 'user_id')
        indexes = [
            models.Index(fields=['user_id', 'role'], name='tripmember_user_role_idx'),
        ]
class Like(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='likes', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('spot', 'user_id')
