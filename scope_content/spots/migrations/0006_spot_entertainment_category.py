from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spots', '0005_spot_postal_code'),
    ]

    operations = [
        migrations.AlterField(
            model_name='spot',
            name='category',
            field=models.CharField(
                choices=[
                    ('food', 'food'),
                    ('nature', 'nature'),
                    ('nightlife', 'nightlife'),
                    ('culture', 'culture'),
                    ('adventure', 'adventure'),
                    ('shopping', 'shopping'),
                    ('entertainment', 'entertainment'),
                    ('scenic', 'scenic'),
                    ('other', 'other'),
                ],
                max_length=50,
            ),
        ),
    ]
