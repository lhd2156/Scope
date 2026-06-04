from app.services.fuel_price_service import FuelPriceService


def test_fuel_stations_explains_google_places_configuration(app, client, auth_header):
    app.config["GOOGLE_PLACES_API_KEY"] = ""

    response = client.get(
        "/api/intel/fuel/stations",
        query_string={"lat": 32.7555, "lng": -97.3308, "radiusKm": 8},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["configured"] is False
    assert payload["stations"] == []
    assert "GOOGLE_PLACES_API_KEY" in payload["coverage"]
    assert payload["source"] == "Google Places"


def test_fuel_stations_requires_auth(client):
    response = client.get("/api/intel/fuel/stations", query_string={"lat": 52.52, "lng": 13.405})

    assert response.status_code == 401


def test_fuel_service_normalizes_and_caches_google_places_response(app, monkeypatch):
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "places": [
                    {
                        "id": "google-station-1",
                        "displayName": {"text": "Scope Travel Stop"},
                        "formattedAddress": "100 Main St, Fort Worth, TX",
                        "location": {"latitude": 32.7565, "longitude": -97.3318},
                        "currentOpeningHours": {"openNow": True},
                        "fuelOptions": {
                            "fuelPrices": [
                                {
                                    "type": "REGULAR_UNLEADED",
                                    "price": {"currencyCode": "USD", "units": "3", "nanos": 190000000},
                                    "updateTime": "2026-05-10T12:00:00Z",
                                },
                                {
                                    "type": "DIESEL",
                                    "price": {"currencyCode": "USD", "units": "3", "nanos": 790000000},
                                    "updateTime": "2026-05-10T12:05:00Z",
                                },
                            ],
                        },
                    }
                ]
            }

    def fake_post(url, headers, json, timeout):
        calls.append((url, headers, json, timeout))
        return FakeResponse()

    monkeypatch.setattr("app.services.fuel_price_service.requests.post", fake_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_CACHE_SECONDS"] = 120

    with app.app_context():
        service = FuelPriceService()
        first = service.get_nearby_stations(lat=32.7555, lng=-97.3308, fuel_type="regular")
        second = service.get_nearby_stations(lat=32.7555, lng=-97.3308, fuel_type="regular")

    assert len(calls) == 1
    url, headers, body, timeout = calls[0]
    assert url.endswith("/places:searchNearby")
    assert headers["X-Goog-FieldMask"]
    assert body["includedTypes"] == ["gas_station"]
    assert body["maxResultCount"] == 20
    assert body["locationRestriction"]["circle"]["radius"] == 10000.0
    assert timeout == 5
    assert first == second
    assert first["sortBy"] == "closest"
    assert first["source"] == "Google Places"
    assert first["stations"][0]["name"] == "Scope Travel Stop"
    assert first["stations"][0]["fuelType"] == "regular"
    assert first["stations"][0]["pricePerUnit"] == 3.19
    assert first["stations"][0]["updatedAt"] == "2026-05-10T12:00:00Z"


def test_fuel_service_sorts_closest_and_best_price_within_radius(app, monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "places": [
                    {
                        "id": "close-station",
                        "displayName": {"text": "Close Fuel"},
                        "formattedAddress": "100 Close St, Fort Worth, TX",
                        "location": {"latitude": 32.756, "longitude": -97.331},
                        "fuelOptions": {
                            "fuelPrices": [
                                {"type": "REGULAR_UNLEADED", "price": {"currencyCode": "USD", "units": "3", "nanos": 690000000}},
                            ],
                        },
                    },
                    {
                        "id": "cheap-station",
                        "displayName": {"text": "Cheap Fuel"},
                        "formattedAddress": "200 Cheap St, Fort Worth, TX",
                        "location": {"latitude": 32.81, "longitude": -97.39},
                        "fuelOptions": {
                            "fuelPrices": [
                                {"type": "REGULAR_UNLEADED", "price": {"currencyCode": "USD", "units": "3", "nanos": 190000000}},
                            ],
                        },
                    },
                ]
            }

    monkeypatch.setattr("app.services.fuel_price_service.requests.post", lambda *args, **kwargs: FakeResponse())
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        service = FuelPriceService()
        closest = service.get_nearby_stations(lat=32.7555, lng=-97.3308, fuel_type="regular", sort_by="closest")
        best_price = service.get_nearby_stations(lat=32.7555, lng=-97.3308, fuel_type="regular", sort_by="best-price")

    assert [station["name"] for station in closest["stations"]] == ["Close Fuel", "Cheap Fuel"]
    assert [station["name"] for station in best_price["stations"]] == ["Cheap Fuel", "Close Fuel"]


def test_fuel_service_returns_unpriced_google_station_when_price_missing(app, monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "places": [
                    {
                        "id": "google-station-2",
                        "displayName": {"text": "No Price Fuel"},
                        "formattedAddress": "200 Main St, Fort Worth, TX",
                        "location": {"latitude": 32.758, "longitude": -97.333},
                    }
                ]
            }

    monkeypatch.setattr("app.services.fuel_price_service.requests.post", lambda *args, **kwargs: FakeResponse())
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        payload = FuelPriceService().get_nearby_stations(lat=32.7555, lng=-97.3308, fuel_type="premium")

    assert payload["configured"] is True
    assert payload["source"] == "Google Places"
    assert payload["stations"][0]["name"] == "No Price Fuel"
    assert payload["stations"][0]["fuelType"] == "premium"
    assert payload["stations"][0]["pricePerUnit"] is None


def test_fuel_service_stops_at_google_places_free_usage_cap(app, monkeypatch, tmp_path):
    def fail_post(*args, **kwargs):
        raise AssertionError("Google should not be called after the local cap is exhausted")

    monkeypatch.setattr("app.services.fuel_price_service.requests.post", fail_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_USAGE_FILE"] = str(tmp_path / "google-places-usage.json")
    app.config["GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP"] = 0

    with app.app_context():
        payload = FuelPriceService().get_nearby_stations(lat=32.7555, lng=-97.3308)

    assert payload["configured"] is True
    assert payload["stations"] == []
    assert "monthly free usage cap reached" in payload["coverage"]
    assert "pay-as-you-go" in payload["coverage"]
