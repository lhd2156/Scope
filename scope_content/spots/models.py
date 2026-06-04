import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Spot(models.Model):
    CATEGORY_CHOICES = [('food','food'),('nature','nature'),('nightlife','nightlife'),('culture','culture'),('adventure','adventure'),('shopping','shopping'),('entertainment','entertainment'),('scenic','scenic'),('other','other')]
    ALLOWED_PILLARS = {
        'hidden-gem',
        'photo-worthy',
        'date-night',
        'group-friendly',
        'solo-friendly',
        'family-friendly',
        'budget-friendly',
        'worth-the-drive',
        'quick-stop',
        'calm',
        'lively',
        'luxury-feel',
    }
    VERIFICATION_LEGACY = 'legacy'
    VERIFICATION_UNVERIFIED = 'unverified'
    VERIFICATION_VERIFIED = 'verified'
    VERIFICATION_REJECTED = 'rejected'
    VERIFICATION_STATUS_CHOICES = [
        (VERIFICATION_LEGACY, 'legacy'),
        (VERIFICATION_UNVERIFIED, 'unverified'),
        (VERIFICATION_VERIFIED, 'verified'),
        (VERIFICATION_REJECTED, 'rejected'),
    ]
    SAFETY_LEGACY = 'legacy'
    SAFETY_CLEAN = 'clean'
    SAFETY_BLOCKED = 'blocked'
    SAFETY_STATUS_CHOICES = [
        (SAFETY_LEGACY, 'legacy'),
        (SAFETY_CLEAN, 'clean'),
        (SAFETY_BLOCKED, 'blocked'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=2000, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.CharField(max_length=500, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=32, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    vibe = models.CharField(max_length=50, blank=True)
    pillars = models.JSONField(default=list, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(1.0), MaxValueValidator(5.0)], null=True, blank=True)
    visited_at = models.DateField(null=True, blank=True)
    is_public = models.BooleanField(default=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS_CHOICES, default=VERIFICATION_UNVERIFIED, db_index=True)
    verification_source = models.CharField(max_length=40, blank=True, default='')
    provider_place_id = models.CharField(max_length=255, blank=True, default='')
    provider_place_name = models.CharField(max_length=255, blank=True, default='')
    provider_place_address = models.CharField(max_length=500, blank=True, default='')
    verification_distance_meters = models.FloatField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    safety_status = models.CharField(max_length=20, choices=SAFETY_STATUS_CHOICES, default=SAFETY_CLEAN, db_index=True)
    safety_reason = models.CharField(max_length=160, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['category']),
            # Covers the public-feed listing and explore pages (ORDER BY
            # created_at DESC WHERE is_public). Without this, every public
            # listing triggers a table scan + top-N sort.
            models.Index(fields=['is_public', '-created_at'], name='spot_ispub_created_idx'),
            # Profile page: "my spots" ordered by recency.
            models.Index(fields=['user_id', '-created_at'], name='spot_user_created_idx'),
            # City filter hit by search. Case-insensitive filters still benefit
            # from the leading-column index because MSSQL / Postgres plan these
            # as range scans when collation is case-insensitive.
            models.Index(fields=['city'], name='spot_city_idx'),
        ]
