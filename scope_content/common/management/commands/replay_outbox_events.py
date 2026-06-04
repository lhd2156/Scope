from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone

from common.events import flush_producer
from common.kafka_producer import ScopeKafkaProducer
from common.models import OutboxEvent


class Command(BaseCommand):
    help = 'Replay pending or failed Content Engine outbox events to Kafka.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--status', choices=[OutboxEvent.STATUS_PENDING, OutboxEvent.STATUS_FAILED], default=OutboxEvent.STATUS_FAILED)

    def handle(self, *args, **options):
        producer = ScopeKafkaProducer()
        limit = max(1, min(int(options['limit']), 1000))
        rows = list(
            OutboxEvent.objects
            .filter(status=options['status'])
            .order_by('created_at')[:limit]
        )

        replayed = 0
        for row in rows:
            try:
                producer.publish(row.topic, row.payload, event_id=str(row.event_id))
                flush_producer(producer)
                OutboxEvent.objects.filter(pk=row.pk).update(
                    status=OutboxEvent.STATUS_PUBLISHED,
                    attempts=F('attempts') + 1,
                    last_error='',
                    published_at=timezone.now(),
                    updated_at=timezone.now(),
                )
                replayed += 1
            except Exception as exc:  # pragma: no cover - broker integration path
                OutboxEvent.objects.filter(pk=row.pk).update(
                    status=OutboxEvent.STATUS_FAILED,
                    attempts=F('attempts') + 1,
                    last_error=str(exc)[:1000],
                    updated_at=timezone.now(),
                )

        self.stdout.write(self.style.SUCCESS(f'Replayed {replayed}/{len(rows)} outbox events.'))
