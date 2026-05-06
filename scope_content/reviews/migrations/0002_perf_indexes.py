# Composite index (spot, created_at DESC) for the reviews-per-spot listing.
# Beats relying on the FK-implied spot index alone when a spot has hundreds
# of reviews: the server can return the first page without a full row fetch
# and sort.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reviews', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='review',
            index=models.Index(fields=['spot', '-created_at'], name='review_spot_created_idx'),
        ),
    ]
