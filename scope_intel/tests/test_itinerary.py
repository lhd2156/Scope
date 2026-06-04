from datetime import date

from app.services.content_client import FixtureContentServiceClient, HttpContentServiceClient, Spot
from app.services.content_client import ContentServiceClient
from app.services.itinerary_engine import ItineraryEngine, WeatherSnapshot


def test_generate_itinerary(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-03", "budget": 500, "interests": ["food", "culture", "nightlife"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Fort Worth, TX"
    assert len(payload["days"]) == 3
    assert payload["weatherForecast"]
    first_spot = payload["days"][0]["spots"][0]
    assert first_spot["reason"]
    assert 0 <= first_spot["confidence"] <= 1

def test_generate_point_to_point_itinerary(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "Dallas, TX", "endDestination": "Austin, TX", "startDate": "2026-04-01", "endDate": "2026-04-02", "budget": 500, "interests": ["food", "culture"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "Dallas, TX to Austin, TX"
    assert len(payload["days"]) == 2

def test_generate_itinerary_accepts_precise_start_coordinates(client, auth_header):
    response = client.post("/api/intel/itinerary/generate", json={"destination": "1600 Pennsylvania Avenue NW, Washington, DC", "destinationLatitude": 38.8977, "destinationLongitude": -77.0365, "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 500, "interests": ["food", "culture"], "pace": "moderate", "groupSize": 2}, headers=auth_header)
    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["destination"] == "1600 Pennsylvania Avenue NW, Washington, DC"
    assert len(payload["days"]) == 1

def test_get_itinerary_by_id(client, auth_header):
    create_response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 200, "interests": ["food"], "pace": "relaxed", "groupSize": 1}, headers=auth_header)
    itinerary_id = create_response.get_json()["data"]["id"]
    fetch_response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)
    assert fetch_response.status_code == 200
    assert fetch_response.get_json()["data"]["id"] == itinerary_id


def test_itinerary_responses_are_private_to_authorized_user(client, auth_header):
    create_response = client.post("/api/intel/itinerary/generate", json={"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-01", "budget": 200, "interests": ["food"], "pace": "relaxed", "groupSize": 1}, headers=auth_header)
    itinerary_id = create_response.get_json()["data"]["id"]
    fetch_response = client.get(f"/api/intel/itinerary/{itinerary_id}", headers=auth_header)

    assert create_response.headers["Cache-Control"] == "private, no-store"
    assert "Authorization" in create_response.headers["Vary"]
    assert fetch_response.headers["Cache-Control"] == "private, no-store"
    assert "Authorization" in fetch_response.headers["Vary"]


def test_content_client_forwards_request_authorization_header(app, auth_header):
    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"data": []}

    class FakeSession:
        def __init__(self):
            self.headers = None

        def get(self, *args, **kwargs):
            self.headers = kwargs.get("headers")
            return FakeResponse()

    session = FakeSession()
    content_client = HttpContentServiceClient("https://content.example/api/content", session=session)

    with app.test_request_context(headers=auth_header):
        assert content_client.get_all_spots() == []

    assert session.headers["Authorization"] == auth_header["Authorization"]


def test_content_client_requires_service_url_outside_tests(app):
    app.config["TESTING"] = False
    app.config["CONTENT_SERVICE_URL"] = ""

    with app.app_context():
        try:
            ContentServiceClient().get_all_spots()
        except RuntimeError as exc:
            assert "CONTENT_SERVICE_URL" in str(exc)
        else:
            raise AssertionError("Expected missing CONTENT_SERVICE_URL to fail outside tests")


def test_itinerary_engine_caps_selection_to_budget():
    engine = ItineraryEngine(FixtureContentServiceClient([
        _spot("expensive", "Expensive Dinner", "food", 0, 0, estimated_cost=220, rating=4.9),
        _spot("cheap", "Good Taco Counter", "food", 0.1, 0.1, estimated_cost=25, rating=4.6),
        _spot("free", "Riverwalk Pause", "scenic", 0.2, 0.2, estimated_cost=0, rating=4.5, is_outdoor=True),
    ]))
    itinerary = engine.generate(
        {
            "destination": "Start",
            "startDate": date(2026, 4, 1),
            "endDate": date(2026, 4, 1),
            "budget": 60,
            "interests": ["food", "scenic"],
            "pace": "moderate",
            "groupSize": 1,
        },
        WeatherSnapshot(summary="Sunny, 75F", sunny_bias=0.8),
    )

    spot_ids = [spot["spotId"] for spot in itinerary["days"][0]["spots"]]
    assert set(spot_ids) == {"cheap", "free"}
    assert "expensive" not in spot_ids
    assert itinerary["totalEstimatedCost"] <= 60


def test_itinerary_engine_orders_selected_stops_between_route_anchors():
    engine = ItineraryEngine(FixtureContentServiceClient([
        _spot("near-end", "Near End", "culture", 0, 9),
        _spot("near-start", "Near Start", "culture", 0, 1),
        _spot("middle", "Middle", "culture", 0, 5),
    ]))
    itinerary = engine.generate(
        {
            "destination": "Start",
            "endDestination": "End",
            "destinationLatitude": 0,
            "destinationLongitude": 0,
            "endDestinationLatitude": 0,
            "endDestinationLongitude": 10,
            "startDate": date(2026, 4, 1),
            "endDate": date(2026, 4, 1),
            "budget": 200,
            "interests": ["culture"],
            "pace": "moderate",
            "groupSize": 1,
        },
        WeatherSnapshot(summary="Sunny, 75F", sunny_bias=0.8),
    )

    spot_ids = [spot["spotId"] for spot in itinerary["days"][0]["spots"]]
    assert spot_ids == ["near-start", "middle", "near-end"]


def _spot(
    spot_id: str,
    title: str,
    category: str,
    latitude: float,
    longitude: float,
    *,
    estimated_cost: float = 10,
    rating: float = 4.5,
    is_outdoor: bool = False,
) -> Spot:
    return Spot(
        spot_id=spot_id,
        title=title,
        description=f"{title} description",
        category=category,
        vibe=category,
        rating=rating,
        popularity=80,
        estimated_cost=estimated_cost,
        latitude=latitude,
        longitude=longitude,
        is_outdoor=is_outdoor,
        photos_count=8,
        liked_by_users=(),
    )
