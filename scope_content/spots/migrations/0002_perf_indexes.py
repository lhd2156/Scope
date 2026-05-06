# Adds composite indexes to cover the hottest read paths: the public feed
# (is_public + created_at), profile listings (user_id + created_at), and the
# city filter. All three are additive (no column changes), so the migration
# is safe to run online on SQL Server Enterprise; on Standard it briefly
# acquires a schema lock equivalent to the table size.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spots', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='spot',
            index=models.Index(fields=['is_public', '-created_at'], name='spot_ispub_created_idx'),
        ),
        migrations.AddIndex(
            model_name='spot',
            index=models.Index(fields=['user_id', '-created_at'], name='spot_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='spot',
            index=models.Index(fields=['city'], name='spot_city_idx'),
        ),
    ]
