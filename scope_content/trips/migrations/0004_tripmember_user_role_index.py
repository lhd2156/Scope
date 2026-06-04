from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0003_trip_destination_share_and_tripspot_source'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='tripmember',
            index=models.Index(fields=['user_id', 'role'], name='tripmember_user_role_idx'),
        ),
    ]
