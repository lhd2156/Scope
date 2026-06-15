from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('photos', '0003_photo_is_anonymous'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='photo',
            options={'ordering': ['sort_order', '-created_at', 'id']},
        ),
        migrations.RemoveIndex(
            model_name='photo',
            name='photo_spot_sort_idx',
        ),
        migrations.AddIndex(
            model_name='photo',
            index=models.Index(fields=['spot', 'sort_order', '-created_at', 'id'], name='photo_spot_best_idx'),
        ),
    ]
