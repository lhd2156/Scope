import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from spots.models import Spot


class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='reviews', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(1.0), MaxValueValidator(5.0)])
    comment = models.CharField(max_length=1000, blank=True)
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
        unique_together = ('spot', 'user_id')
        indexes = [
            # Reviews list for a spot: ORDER BY created_at DESC WHERE spot_id=?.
            # Composite beats two single-column indexes for this exact access.
            models.Index(fields=['spot', '-created_at'], name='review_spot_created_idx'),
        ]
