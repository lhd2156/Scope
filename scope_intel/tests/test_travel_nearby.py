from app.services.spot import Spot
import pytest

from app.services.travel_nearby_service import TravelNearbyService


class FakeContentClient:
    def __init__(self, spots=None):
        self._spots = spots or [
            Spot(
                spot_id="scope-scenic-1",
                title="Community Overlook",
                description="A loved scenic stop from Scope users.",
                category="scenic",
                vibe="sunset",
                rating=4.8,
                popularity=42,
                estimated_cost=0,
                latitude=32.78,
                longitude=-96.8,
                is_outdoor=True,
                photos_count=3,
                liked_by_users=("user-1",),
            )
        ]

    def nearby_spots(self, lat, lng, radius_km, limit=50):
        return self._spots[:limit]


def _anchor():
    return {
        "id": "planner-start",
        "placeLabel": "Dallas",
        "latitude": 32.7767,
        "longitude": -96.797,
        "routeRole": "start",
    }


def test_travel_nearby_requires_auth(client):
    response = client.post("/api/intel/travel/nearby", json={"anchors": [_anchor()]})

    assert response.status_code == 401


def test_travel_nearby_endpoint_returns_service_payload(client, auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.api.travel.service.get_nearby",
        lambda payload: {
            "configured": False,
            "coverage": "Scope-only",
            "source": "Scope + Google Places",
            "category": payload["category"],
            "radiusKm": payload["radiusKm"],
            "suggestions": [],
        },
    )

    response = client.post(
        "/api/intel/travel/nearby",
        json={"anchors": [_anchor()], "category": "stay", "radiusKm": 12},
        headers=auth_header,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["category"] == "stay"
    assert payload["radiusKm"] == 12


def test_travel_nearby_returns_scope_only_when_google_is_unconfigured(app):
    app.config["GOOGLE_PLACES_API_KEY"] = ""

    with app.app_context():
        payload = TravelNearbyService(FakeContentClient()).get_nearby(
            {
                "anchors": [_anchor()],
                "category": "recommended",
                "interests": ["scenic"],
                "limit": 5,
            }
        )

    assert payload["configured"] is False
    assert "GOOGLE_PLACES_API_KEY" in payload["coverage"]
    assert payload["suggestions"][0]["source"] == "scope"
    assert payload["suggestions"][0]["title"] == "Community Overlook"
    assert "Scope community" in payload["suggestions"][0]["reason"]


def test_travel_nearby_blends_google_lodging_with_scope(app, monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "places": [
                    {
                        "id": "google-hotel-1",
                        "displayName": {"text": "Route Rest Hotel"},
                        "formattedAddress": "100 Sleep St, Dallas, TX",
                        "location": {"latitude": 32.777, "longitude": -96.799},
                        "primaryType": "hotel",
                        "types": ["hotel", "lodging"],
                        "rating": 4.6,
                        "userRatingCount": 890,
                        "priceLevel": "PRICE_LEVEL_MODERATE",
                        "currentOpeningHours": {"openNow": True},
                        "photos": [
                            {
                                "name": "places/google-hotel-1/photos/photo-resource-1",
                                "authorAttributions": [
                                    {
                                        "displayName": "Route Rest Hotel",
                                        "uri": "https://maps.google.com/maps/contrib/123",
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }

    class FakePhotoResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"photoUri": "https://lh3.googleusercontent.com/route-rest-hotel=s480"}

    calls = []
    media_calls = []

    def fake_post(url, headers, json, timeout):
        calls.append((url, headers, json, timeout))
        return FakeResponse()

    def fake_get(url, params, timeout):
        media_calls.append((url, params, timeout))
        return FakePhotoResponse()

    monkeypatch.setattr("app.services.travel_nearby_service.requests.post", fake_post)
    monkeypatch.setattr("app.services.travel_nearby_service.requests.get", fake_get)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP"] = 1000
    app.config["GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP"] = 1000

    with app.app_context():
        payload = TravelNearbyService(FakeContentClient()).get_nearby(
            {
                "anchors": [_anchor()],
                "category": "stay",
                "budgetCeiling": 900,
                "pace": "relaxed",
                "limit": 5,
            }
        )

    assert calls
    assert calls[0][2]["includedTypes"] == ["hotel", "motel", "hostel", "campground", "rv_park"]
    assert media_calls[0][0].endswith("/places/google-hotel-1/photos/photo-resource-1/media")
    assert payload["configured"] is True
    assert payload["suggestions"][0]["source"] == "google"
    assert payload["suggestions"][0]["category"] == "stay"
    assert payload["suggestions"][0]["priceLabel"] == "$$"
    assert payload["suggestions"][0]["photoUrl"] == "https://lh3.googleusercontent.com/route-rest-hotel=s480"
    assert payload["suggestions"][0]["photoAttribution"] == "Route Rest Hotel"
    assert "_photoName" not in payload["suggestions"][0]
    assert "open now" in payload["suggestions"][0]["reason"]


@pytest.mark.parametrize(
    "category,bad_place,good_place,expected_title,expected_category",
    [
        (
            "food",
            {
                "id": "google-weigh-station-1",
                "displayName": {"text": "Odessa Weigh Station"},
                "formattedAddress": "I-20, Odessa, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "weigh_station",
                "types": ["weigh_station", "police"],
            },
            {
                "id": "google-diner-1",
                "displayName": {"text": "Odessa Diner"},
                "formattedAddress": "400 Plate Rd, Odessa, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "restaurant",
                "types": ["restaurant"],
            },
            "Odessa Diner",
            "food",
        ),
        (
            "stay",
            {
                "id": "google-fuel-1",
                "displayName": {"text": "Corner Gas"},
                "formattedAddress": "10 Pump Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "gas_station",
                "types": ["gas_station"],
            },
            {
                "id": "google-hotel-1",
                "displayName": {"text": "Route Rest Hotel"},
                "formattedAddress": "100 Sleep St, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "hotel",
                "types": ["hotel", "lodging"],
            },
            "Route Rest Hotel",
            "stay",
        ),
        (
            "essentials",
            {
                "id": "google-gallery-1",
                "displayName": {"text": "Downtown Gallery"},
                "formattedAddress": "2 Art Way, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "art_gallery",
                "types": ["art_gallery", "tourist_attraction"],
            },
            {
                "id": "google-pharmacy-1",
                "displayName": {"text": "CVS Pharmacy"},
                "formattedAddress": "3 Care Rd, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "pharmacy",
                "types": ["pharmacy", "store"],
            },
            "CVS Pharmacy",
            "essentials",
        ),
        (
            "scenic",
            {
                "id": "google-gas-2",
                "displayName": {"text": "Main Street Fuel"},
                "formattedAddress": "10 Pump Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "gas_station",
                "types": ["gas_station"],
            },
            {
                "id": "google-park-1",
                "displayName": {"text": "Lake Trail Park"},
                "formattedAddress": "5 Lake Trail, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "park",
                "types": ["park", "tourist_attraction"],
            },
            "Lake Trail Park",
            "nature",
        ),
        (
            "entertainment",
            {
                "id": "google-clinic-1",
                "displayName": {"text": "Route Urgent Care"},
                "formattedAddress": "8 Clinic Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "hospital",
                "types": ["hospital"],
            },
            {
                "id": "google-bowling-1",
                "displayName": {"text": "Route Bowling Lanes"},
                "formattedAddress": "9 Play Way, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "bowling_alley",
                "types": ["bowling_alley", "point_of_interest"],
            },
            "Route Bowling Lanes",
            "entertainment",
        ),
        (
            "outdoors",
            {
                "id": "google-mall-1",
                "displayName": {"text": "Indoor Mall"},
                "formattedAddress": "6 Retail Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "shopping_mall",
                "types": ["shopping_mall"],
            },
            {
                "id": "google-trail-1",
                "displayName": {"text": "Lake Trail Park"},
                "formattedAddress": "5 Lake Trail, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "park",
                "types": ["park", "tourist_attraction"],
            },
            "Lake Trail Park",
            "nature",
        ),
        (
            "shopping",
            {
                "id": "google-gas-3",
                "displayName": {"text": "Route Gas Station"},
                "formattedAddress": "7 Fuel Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "gas_station",
                "types": ["gas_station"],
            },
            {
                "id": "google-shopping-1",
                "displayName": {"text": "Bishop Arts Market"},
                "formattedAddress": "9 Market Way, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "shopping_mall",
                "types": ["shopping_mall", "store", "point_of_interest"],
            },
            "Bishop Arts Market",
            "shopping",
        ),
        (
            "nightlife",
            {
                "id": "google-pharmacy-2",
                "displayName": {"text": "Late Night Pharmacy"},
                "formattedAddress": "7 Care Rd, Dallas, TX",
                "location": {"latitude": 32.777, "longitude": -96.799},
                "primaryType": "pharmacy",
                "types": ["pharmacy"],
            },
            {
                "id": "google-bar-1",
                "displayName": {"text": "Deep Ellum Listening Room"},
                "formattedAddress": "10 Music Ave, Dallas, TX",
                "location": {"latitude": 32.778, "longitude": -96.8},
                "primaryType": "bar",
                "types": ["bar", "night_club", "point_of_interest"],
            },
            "Deep Ellum Listening Room",
            "nightlife",
        ),
    ],
)
def test_travel_nearby_filters_google_places_to_requested_pillar(
    app,
    monkeypatch,
    tmp_path,
    category,
    bad_place,
    good_place,
    expected_title,
    expected_category,
):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"places": [bad_place, good_place]}

    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append((url, headers, json, timeout))
        return FakeResponse()

    monkeypatch.setattr("app.services.travel_nearby_service.requests.post", fake_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_USAGE_FILE"] = str(tmp_path / "google-places-usage.json")
    app.config["GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP"] = 1000

    with app.app_context():
        payload = TravelNearbyService(FakeContentClient()).get_nearby(
            {
                "anchors": [_anchor()],
                "category": category,
                "limit": 5,
            }
        )

    titles = [suggestion["title"] for suggestion in payload["suggestions"]]
    assert calls
    assert expected_title in titles
    assert bad_place["displayName"]["text"] not in titles
    suggestion = next(item for item in payload["suggestions"] if item["title"] == expected_title)
    assert suggestion["source"] == "google"
    assert suggestion["category"] == expected_category
    if category == "entertainment":
        assert calls[0][2]["includedTypes"] == [
            "amusement_park",
            "bowling_alley",
            "movie_theater",
            "tourist_attraction",
        ]
    if category == "nightlife":
        assert calls[0][2]["includedTypes"] == [
            "bar",
            "night_club",
            "restaurant",
            "performing_arts_theater",
        ]
    if category == "outdoors":
        assert calls[0][2]["includedTypes"] == [
            "park",
            "campground",
            "tourist_attraction",
        ]
    if category == "shopping":
        assert calls[0][2]["includedTypes"] == [
            "shopping_mall",
            "store",
            "clothing_store",
            "book_store",
        ]


def test_travel_nearby_stops_google_at_usage_cap(app, monkeypatch, tmp_path):
    def fail_post(*args, **kwargs):
        raise AssertionError("Google should not be called after the cap is exhausted")

    monkeypatch.setattr("app.services.travel_nearby_service.requests.post", fail_post)
    app.config["GOOGLE_PLACES_API_KEY"] = "test-google-key"
    app.config["GOOGLE_PLACES_USAGE_FILE"] = str(tmp_path / "google-places-usage.json")
    app.config["GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP"] = 0

    with app.app_context():
        payload = TravelNearbyService(FakeContentClient()).get_nearby(
            {
                "anchors": [_anchor()],
                "category": "scenic",
                "limit": 5,
            }
        )

    assert payload["configured"] is True
    assert "monthly free usage cap reached" in payload["coverage"]
    assert payload["suggestions"][0]["source"] == "scope"
