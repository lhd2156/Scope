from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('target_type', models.CharField(choices=[('spot', 'spot'), ('trip', 'trip')], max_length=20)),
                ('target_id', models.UUIDField(db_index=True)),
                ('user_id', models.UUIDField(db_index=True)),
                ('body', models.TextField(max_length=1000)),
                ('status', models.CharField(choices=[('active', 'active'), ('deleted', 'deleted')], db_index=True, default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replies', to='comments.comment')),
            ],
            options={
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['target_type', 'target_id', 'created_at'], name='comment_target_created_idx'),
                    models.Index(fields=['parent', 'created_at'], name='comment_parent_created_idx'),
                    models.Index(fields=['user_id', '-created_at'], name='comment_user_created_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='CommentMention',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('mentioned_user_id', models.UUIDField(db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentions', to='comments.comment')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['mentioned_user_id', '-created_at'], name='cm_user_created_idx'),
                ],
                'unique_together': {('comment', 'mentioned_user_id')},
            },
        ),
    ]
