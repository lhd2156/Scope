"""Tests for Elasticsearch document indexing helpers."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from common.indexing import delete_spot


def test_delete_spot_ignores_missing_documents_with_supported_client_options():
    client = MagicMock()
    with patch('common.indexing.get_es_client', return_value=client):
        delete_spot('spot-1')

    client.options.assert_called_once_with(ignore_status=[404])
    client.options.return_value.delete.assert_called_once_with(index='scope-spots', id='spot-1')
