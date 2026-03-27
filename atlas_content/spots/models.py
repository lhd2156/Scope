import uuid
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
class Spot(models.Model):
    CATEGORY_CHOICES = [('food','food'),('nature','nature'),('nightlife','nightlife'),('culture','culture'),('adventure','adventure'),('shopping','shopping'),('scenic','scenic'),('other','other')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=2000, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.CharField(max_length=500, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    vibe = models.CharField(max_length=50, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(1.0), MaxValueValidator(5.0)], null=True, blank=True)
    visited_at = models.DateField(null=True, blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['latitude', 'longitude']), models.Index(fields=['category'])]
