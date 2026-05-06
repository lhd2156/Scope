# Photos are always loaded per spot in (sort_order, created_at). The
# composite (spot, sort_order, created_at) index matches this exact access
# path and eliminates filesort on spots with many photos.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('photos', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='photo',
            index=models.Index(fields=['spot', 'sort_order', 'created_at'], name='photo_spot_sort_idx'),
        ),
    ]
