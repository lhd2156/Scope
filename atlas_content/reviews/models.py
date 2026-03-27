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
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
        unique_together = ('spot', 'user_id')
