from app.services.place_photo_service import PlacePhotoService


def test_place_photo_explains_google_places_configuration(app, client, auth_header):
    app.config["GOOGLE_PLACES_API_KEY"] = ""

    response = client.get(
        "/api/intel/place-photo",
        query_string={"q": "Soulman's BBQ", "lat": 32.837, "lng": -97.189},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["configured"] is False
    assert payload["photoUrl"] is None
    assert "GOOGLE_PLACES_API_KEY" in payload["coverage"]
    assert payload["source"] == "Google Places"


def test_place_photo_requires_auth(client):
    response = client.get("/api/intel/place-photo", query_string={"q": "Soulman's BBQ", "lat": 32.837, "lng": -97.189})

    assert response.status_code == 401


def test_place_photo_service_normalizes_google_photo_response(app, monkeypatch):
    calls = []

    class SearchResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "places": [
                    {
                        "id": "google-place-1",
                        "displayName": {"text": "Soulman's BBQ"},
                        "formattedAddress": "565 W Bedford Euless Rd, Hurst, TX",
                        "location": {"latitude": 32.8369, "longitude": -97.1889},
                        "photos": [
                            {
                                "name": "places/google-place-1/photos/photo-resource-1",
                                "authorAttributions": [
                                    {
                                        "displayName": "Soulman's BBQ",
                                        "uri": "//maps.google.com/maps/contrib/123",
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }

    class PhotoResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"photoUri": "https://lh3.googleusercontent.com/place-photo=s640"}

    def fake_post(url, headers, json, timeout):
        calls.append(("post", url, headers, json, timeout))
        return SearchResponse()

    def fake_get(url, params, timeout):
        calls.append(("get", url, params, timeout))
        return PhotoResponse()

    monkeypatch.setattr("app.services.place_photo_service.requests.post", fake_post)
    monkeypatch.setattr("app.services.place_photo_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        payload = PlacePhotoService().get_featured_photo(
            query="Soulman's BBQ",
            address="565 W Bedford Euless Rd, Hurst, TX",
            lat=32.837,
            lng=-97.189,
            max_width_px=720,
        )

    assert [call[0] for call in calls] == ["post", "get"]
    _, search_url, search_headers, search_body, search_timeout = calls[0]
    assert search_url.endswith("/places:searchText")
    assert search_headers["X-Goog-FieldMask"].endswith("places.photos")
    assert search_body["textQuery"].startswith("Soulman's BBQ")
    assert search_body["locationBias"]["circle"]["radius"] == 1200
    assert search_timeout == 5

    _, photo_url, photo_params, photo_timeout = calls[1]
    assert photo_url.endswith("/places/google-place-1/photos/photo-resource-1/media")
    assert photo_params["maxWidthPx"] == 720
    assert photo_params["skipHttpRedirect"] == "true"
    assert photo_timeout == 5

    assert payload["configured"] is True
    assert payload["photoUrl"] == "https://lh3.googleusercontent.com/place-photo=s640"
    assert payload["photoAttribution"] == "Soulman's BBQ"
    assert payload["photoAttributionUrl"] == "//maps.google.com/maps/contrib/123"
    assert payload["source"] == "Google Places"


def test_place_photo_service_returns_empty_when_google_has_no_photo(app, monkeypatch):
    class SearchResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"places": [{"id": "google-place-2", "displayName": {"text": "No Photo Place"}}]}

    monkeypatch.setattr("app.services.place_photo_service.requests.post", lambda *args, **kwargs: SearchResponse())
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"

    with app.app_context():
        payload = PlacePhotoService().get_featured_photo(query="No Photo Place", lat=32.837, lng=-97.189)

    assert payload["configured"] is True
    assert payload["photoUrl"] is None
    assert "did not return a photo" in payload["coverage"]


def test_place_photo_service_stops_at_free_usage_cap(app, monkeypatch, tmp_path):
    def fail_post(*args, **kwargs):
        raise AssertionError("Google should not be called after the local cap is exhausted")

    monkeypatch.setattr("app.services.place_photo_service.requests.post", fail_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_USAGE_FILE"] = str(tmp_path / "google-places-usage.json")
    app.config["GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP"] = 0

    with app.app_context():
        payload = PlacePhotoService().get_featured_photo(query="Soulman's BBQ", lat=32.837, lng=-97.189)

    assert payload["configured"] is True
    assert payload["photoUrl"] is None
    assert "Text Search Pro monthly free usage cap reached" in payload["coverage"]
    assert "pay-as-you-go" in payload["coverage"]
