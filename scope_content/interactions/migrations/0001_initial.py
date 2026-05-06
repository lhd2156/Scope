import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Interaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField(db_index=True)),
                ('spot_id', models.UUIDField(db_index=True)),
                ('interaction_type', models.CharField(
                    choices=[
                        ('view', 'view'),
                        ('dwell', 'dwell'),
                        ('click', 'click'),
                        ('like', 'like'),
                        ('save', 'save'),
                        ('visit', 'visit'),
                        ('review', 'review'),
                        ('share', 'share'),
                        ('dismiss', 'dismiss'),
                        ('hide', 'hide'),
                    ],
                    db_index=True,
                    max_length=32,
                )),
                ('context', models.JSONField(blank=True, null=True)),
                ('occurred_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'ordering': ['-occurred_at'],
                'indexes': [
                    models.Index(fields=['user_id', 'occurred_at'], name='ix_interaction_user_time'),
                    models.Index(fields=['spot_id', 'occurred_at'], name='ix_interaction_spot_time'),
                ],
            },
        ),
    ]
