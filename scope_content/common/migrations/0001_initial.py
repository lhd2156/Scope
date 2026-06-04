from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='OutboxEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('topic', models.CharField(db_index=True, max_length=120)),
                ('payload', models.JSONField()),
                ('status', models.CharField(choices=[('pending', 'pending'), ('published', 'published'), ('failed', 'failed')], db_index=True, default='pending', max_length=20)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('last_error', models.CharField(blank=True, default='', max_length=1000)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status', 'created_at'], name='outbox_status_created_idx'),
                    models.Index(fields=['topic', 'created_at'], name='outbox_topic_created_idx'),
                ],
            },
        ),
    ]
