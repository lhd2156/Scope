"""Django management command to bulk-reindex all data to Elasticsearch."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from common.indexing import index_review, index_spot, index_trip
from common.search import ensure_indexes


class Command(BaseCommand):
    help = 'Reindex all spots, reviews, and trips to Elasticsearch'

    def handle(self, *args, **options):
        ensure_indexes()

        from reviews.models import Review
        from spots.models import Spot
        from trips.models import Trip

        spots = Spot.objects.all()
        self.stdout.write(f'Indexing {spots.count()} spots...')
        for spot in spots.iterator():
            index_spot(spot)

        reviews = Review.objects.all()
        self.stdout.write(f'Indexing {reviews.count()} reviews...')
        for review in reviews.iterator():
            index_review(review)

        trips = Trip.objects.all()
        self.stdout.write(f'Indexing {trips.count()} trips...')
        for trip in trips.iterator():
            index_trip(trip)

        self.stdout.write(self.style.SUCCESS('Reindex complete.'))
