from app.services.place_verification_service import PlaceVerificationService
import requests


class JsonResponse:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        return None

    def json(self):
        return self._body


def test_place_verify_requires_auth(client):
    response = client.post(
        "/api/intel/place/verify",
        json={"title": "Best Tacos", "latitude": 32.7555, "longitude": -97.3308},
    )

    assert response.status_code == 401


def test_google_place_within_200m_verifies(app, monkeypatch):
    def fake_post(url, headers, json, timeout):
        return JsonResponse(
            {
                "places": [
                    {
                        "id": "google-place-1",
                        "displayName": {"text": "Best Tacos"},
                        "formattedAddress": "123 Main St, Fort Worth, TX",
                        "location": {"latitude": 32.7556, "longitude": -97.3309},
                        "types": ["restaurant", "point_of_interest", "establishment"],
                        "addressComponents": [
                            {"longText": "Fort Worth", "shortText": "Fort Worth", "types": ["locality"]},
                            {"longText": "United States", "shortText": "US", "types": ["country"]},
                            {"longText": "76102", "shortText": "76102", "types": ["postal_code"]},
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.post", fake_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Best Tacoz",
                "address": "123 Main St",
                "city": "Fort Worth",
                "country": "US",
                "postalCode": "76102",
                "latitude": 32.7555,
                "longitude": -97.3308,
            }
        )

    assert payload["verified"] is True
    assert payload["source"] == "google_places"
    assert payload["providerPlaceId"] == "google-place-1"
    assert payload["city"] == "Fort Worth"
    assert payload["country"] == "US"
    assert payload["postalCode"] == "76102"


def test_far_away_provider_result_fails(app, monkeypatch):
    def fake_post(url, headers, json, timeout):
        return JsonResponse(
            {
                "places": [
                    {
                        "id": "google-place-2",
                        "displayName": {"text": "Best Tacos"},
                        "formattedAddress": "123 Main St, Dallas, TX",
                        "location": {"latitude": 32.7767, "longitude": -96.797},
                        "types": ["restaurant", "point_of_interest"],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.post", fake_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Best Tacos",
                "address": "123 Main St",
                "latitude": 32.7555,
                "longitude": -97.3308,
            }
        )

    assert payload["verified"] is False
    assert "too far" in payload["reason"]


def test_city_only_result_fails(app, monkeypatch):
    def fake_get(url, params, timeout):
        return JsonResponse(
            {
                "features": [
                    {
                        "id": "place.123",
                        "text": "Fort Worth",
                        "place_name": "Fort Worth, Texas, United States",
                        "center": [-97.3308, 32.7555],
                        "place_type": ["place"],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Fort Worth",
                "address": "",
                "latitude": 32.7555,
                "longitude": -97.3308,
            }
        )

    assert payload["verified"] is False
    assert "specific POI" in payload["reason"]


def test_mapbox_address_prefers_municipality_over_neighborhood(app, monkeypatch):
    def fake_get(url, params, timeout):
        return JsonResponse(
            {
                "features": [
                    {
                        "id": "address.1",
                        "text": "Commerce Street",
                        "place_name": "1502 Commerce Street, Fort Worth, Texas 76102, United States",
                        "center": [-97.326647, 32.747787],
                        "place_type": ["address"],
                        "context": [
                            {"id": "locality.1", "text": "Downtown Fort Worth"},
                            {"id": "neighborhood.1", "text": "Downtown Fort Worth"},
                            {"id": "postcode.1", "text": "76102"},
                            {"id": "region.1", "text": "Texas", "short_code": "US-TX"},
                            {"id": "country.1", "text": "United States", "short_code": "us"},
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Fort Worth Water Gardens",
                "address": "1502 Commerce St",
                "city": "Fort Worth",
                "latitude": 32.7477,
                "longitude": -97.3267,
            }
        )

    assert payload["verified"] is True
    assert payload["city"] == "Fort Worth"
    assert payload["candidates"][0]["city"] == "Fort Worth"


def test_mapbox_poi_prefers_place_over_locality(app, monkeypatch):
    def fake_get(url, params, timeout):
        return JsonResponse(
            {
                "features": [
                    {
                        "id": "poi.1",
                        "text": "Empire State Building",
                        "place_name": "Empire State Building, Manhattan, New York, New York 10001, United States",
                        "center": [-73.98566, 40.74844],
                        "place_type": ["poi"],
                        "context": [
                            {"id": "locality.1", "text": "Manhattan"},
                            {"id": "place.1", "text": "New York"},
                            {"id": "postcode.1", "text": "10001"},
                            {"id": "region.1", "text": "New York", "short_code": "US-NY"},
                            {"id": "country.1", "text": "United States", "short_code": "us"},
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Empire State Building",
                "address": "20 W 34th St",
                "city": "New York",
                "latitude": 40.74844,
                "longitude": -73.98566,
            }
        )

    assert payload["verified"] is True
    assert payload["city"] == "New York"
    assert payload["candidates"][0]["city"] == "New York"


def test_mapbox_exact_address_within_radius_verifies_without_name_match(app, monkeypatch):
    def fake_get(url, params, timeout):
        return JsonResponse(
            {
                "features": [
                    {
                        "id": "address.2",
                        "text": "East Randolph Street",
                        "place_name": "201 East Randolph Street, Chicago, Illinois 60601, United States",
                        "center": [-87.62355, 41.8828],
                        "place_type": ["address"],
                        "context": [
                            {"id": "place.1", "text": "Chicago"},
                            {"id": "postcode.1", "text": "60601"},
                            {"id": "country.1", "text": "United States", "short_code": "us"},
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr("app.services.place_verification_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Millennium Park",
                "address": "201 E Randolph St",
                "city": "Chicago",
                "latitude": 41.88265,
                "longitude": -87.62255,
            }
        )

    assert payload["verified"] is True
    assert payload["source"] == "mapbox"
    assert payload["city"] == "Chicago"


def test_provider_outage_does_not_fabricate_match(app, monkeypatch):
    def fail_get(*args, **kwargs):
        raise requests.RequestException("provider down")

    monkeypatch.setattr("app.services.place_verification_service.requests.get", fail_get)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    app.config["MAPBOX_ACCESS_TOKEN"] = "pk.test"

    with app.app_context():
        payload = PlaceVerificationService().verify(
            {
                "title": "Best Tacos",
                "address": "123 Main St",
                "latitude": 32.7555,
                "longitude": -97.3308,
            }
        )

    assert payload["verified"] is False
    assert payload["candidates"] == []
