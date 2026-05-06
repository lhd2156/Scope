"""Tests for Celery tasks."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.conf import settings


class TestReindexSpotTask:
    @patch('common.tasks.index_spot')
    @patch('spots.models.Spot.objects')
    def test_reindex_spot_success(self, mock_objects, mock_index):
        from common.tasks import reindex_spot_task

        mock_spot = MagicMock(id='spot-1')
        mock_objects.get.return_value = mock_spot

        result = reindex_spot_task('spot-1')
        assert result['status'] == 'indexed'
        mock_index.assert_called_once_with(mock_spot)


class TestBulkReindexTask:
    @patch('common.tasks.index_spot')
    @patch('spots.models.Spot.objects')
    @patch('common.tasks.ensure_indexes')
    def test_bulk_reindex_spots(self, mock_ensure, mock_objects, mock_index):
        from common.tasks import bulk_reindex_task

        mock_objects.all.return_value.iterator.return_value = [MagicMock(), MagicMock()]
        result = bulk_reindex_task('spots')
        assert result['indexed'] == 2


def test_celery_routes_match_worker_queues():
    assert settings.CELERY_TASK_DEFAULT_QUEUE == 'default'
    assert settings.CELERY_TASK_ROUTES['common.tasks.reindex_spot_task']['queue'] == 'reindex'
    assert settings.CELERY_TASK_ROUTES['common.tasks.bulk_reindex_task']['queue'] == 'reindex'
    assert settings.CELERY_TASK_ROUTES['common.tasks.analyze_review_sentiment_task']['queue'] == 'sentiment'
    assert settings.CELERY_TASK_ROUTES['common.tasks.classify_photo_task']['queue'] == 'classification'
