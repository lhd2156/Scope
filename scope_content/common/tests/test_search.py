"""Tests for Elasticsearch search integration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from django.test import RequestFactory

from common.views_search import GeoSearchView, SearchView


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def mock_es():
    with patch('common.views_search.get_es_client') as mock:
        client = MagicMock()
        mock.return_value = client
        yield client


class TestSearchView:
    def test_missing_query_returns_400(self, rf):
        request = rf.get('/api/content/search')
        response = SearchView.as_view()(request)
        assert response.status_code == 400

    def test_invalid_type_returns_400(self, rf):
        request = rf.get('/api/content/search?q=test&type=invalid')
        response = SearchView.as_view()(request)
        assert response.status_code == 400

    def test_successful_search(self, rf, mock_es):
        mock_es.search.return_value = {
            'hits': {
                'total': {'value': 1},
                'hits': [
                    {
                        '_source': {'id': '1', 'name': 'Test Spot'},
                        '_score': 1.5,
                        'highlight': {'name': ['<em>Test</em> Spot']},
                    }
                ],
            }
        }
        request = rf.get('/api/content/search?q=test&type=spots')
        response = SearchView.as_view()(request)
        assert response.status_code == 200

    def test_es_unavailable_returns_503(self, rf):
        with patch('common.views_search.get_es_client', return_value=None):
            request = rf.get('/api/content/search?q=test')
            response = SearchView.as_view()(request)
            assert response.status_code == 503


class TestGeoSearchView:
    def test_invalid_coordinates_returns_400(self, rf):
        request = rf.get('/api/content/search/nearby?lat=abc&lon=xyz')
        response = GeoSearchView.as_view()(request)
        assert response.status_code == 400

    def test_successful_geo_search(self, rf, mock_es):
        mock_es.search.return_value = {
            'hits': {
                'total': {'value': 1},
                'hits': [
                    {
                        '_source': {'id': '1', 'name': 'Nearby Spot', 'location': {'lat': 40.71, 'lon': -74.01}},
                        'sort': [0.5],
                    }
                ],
            }
        }
        request = rf.get('/api/content/search/nearby?lat=40.7128&lon=-74.006&radius=5km')
        response = GeoSearchView.as_view()(request)
        assert response.status_code == 200
