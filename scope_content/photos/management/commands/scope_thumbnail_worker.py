"""Runs the background thumbnail generation consumer loop.

Usage (inside the image, typically from the content-worker compose service):

    python manage.py scope_thumbnail_worker

The actual loop lives in `photos.services.thumbnail_worker` so it can be
imported and exercised by tests without a Django management-command harness.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from photos.services.thumbnail_worker import run


class Command(BaseCommand):
    help = 'Consume photo.thumbnail.requested events and generate thumbnails.'

    def handle(self, *args, **options) -> None:
        run()
