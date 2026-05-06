import uuid

from django.db import models

from spots.models import Spot


class Photo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='photos', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    storage_key = models.CharField(max_length=500)
    storage_url = models.URLField(max_length=1000)
    thumbnail_url = models.URLField(max_length=1000, blank=True)
    caption = models.CharField(max_length=500, blank=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['sort_order', 'created_at']
        indexes = [
            # Photos are always loaded in (sort_order, created_at) per spot.
            # This composite matches the access path exactly and avoids a
            # filesort for spots with many photos.
            models.Index(fields=['spot', 'sort_order', 'created_at'], name='photo_spot_sort_idx'),
        ]
