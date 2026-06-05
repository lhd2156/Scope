from __future__ import annotations


def test_unmatched_api_route_returns_json_404(api_client):
    response = api_client.get('/api/content/spots/not-a-real-route/')

    assert response.status_code == 404
    assert response.headers['Content-Type'].startswith('application/json')
    assert response.json()['error']['code'] == 'NOT_FOUND'
