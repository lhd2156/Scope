from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('photos', '0002_perf_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='photo',
            name='is_anonymous',
            field=models.BooleanField(default=False),
        ),
    ]
