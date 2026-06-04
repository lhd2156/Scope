from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('spots', '0004_spot_publish_verification'),
    ]

    operations = [
        migrations.AddField(
            model_name='spot',
            name='postal_code',
            field=models.CharField(blank=True, max_length=32),
        ),
    ]
