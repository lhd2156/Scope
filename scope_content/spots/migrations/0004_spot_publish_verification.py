from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spots', '0003_fulltext_search'),
    ]

    operations = [
        migrations.AddField(
            model_name='spot',
            name='pillars',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='spot',
            name='verification_status',
            field=models.CharField(
                choices=[
                    ('legacy', 'legacy'),
                    ('unverified', 'unverified'),
                    ('verified', 'verified'),
                    ('rejected', 'rejected'),
                ],
                db_index=True,
                default='legacy',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='spot',
            name='verification_source',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='spot',
            name='provider_place_id',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='spot',
            name='provider_place_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='spot',
            name='provider_place_address',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='spot',
            name='verification_distance_meters',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='spot',
            name='verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='spot',
            name='safety_status',
            field=models.CharField(
                choices=[
                    ('legacy', 'legacy'),
                    ('clean', 'clean'),
                    ('blocked', 'blocked'),
                ],
                db_index=True,
                default='legacy',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='spot',
            name='safety_reason',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
        migrations.AlterField(
            model_name='spot',
            name='verification_status',
            field=models.CharField(
                choices=[
                    ('legacy', 'legacy'),
                    ('unverified', 'unverified'),
                    ('verified', 'verified'),
                    ('rejected', 'rejected'),
                ],
                db_index=True,
                default='unverified',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='spot',
            name='safety_status',
            field=models.CharField(
                choices=[
                    ('legacy', 'legacy'),
                    ('clean', 'clean'),
                    ('blocked', 'blocked'),
                ],
                db_index=True,
                default='clean',
                max_length=20,
            ),
        ),
    ]
