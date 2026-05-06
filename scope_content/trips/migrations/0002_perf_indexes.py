# Covers the two dominant Trip queries: public-trip listing (is_public +
# created_at) and "my trips" (creator_id + created_at). The existing
# unique_together indexes on TripSpot and TripMember already cover their
# access paths.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['is_public', '-created_at'], name='trip_ispub_created_idx'),
        ),
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['creator_id', '-created_at'], name='trip_creator_created_idx'),
        ),
    ]
