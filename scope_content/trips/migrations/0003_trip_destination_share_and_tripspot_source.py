from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0002_perf_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='trip',
            name='destination',
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name='trip',
            name='share_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='share_token',
            field=models.UUIDField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='tripspot',
            name='source',
            field=models.CharField(
                choices=[('saved_spot', 'saved_spot'), ('planner_generated', 'planner_generated')],
                default='saved_spot',
                max_length=32,
            ),
        ),
    ]
