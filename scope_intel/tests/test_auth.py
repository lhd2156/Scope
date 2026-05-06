import pytest

PUBLIC_ROUTE_EXCEPTIONS = {
    "/api/intel/classify-image",
    "/api/intel/health",
    "/api/intel/metrics",
    "/api/intel/ml/info",
    "/api/intel/predict-trip",
    "/api/intel/sentiment",
}

PROTECTED_ROUTE_CASES = [
    ("POST", "/api/intel/itinerary/generate", {"json": {"destination": "Fort Worth, TX", "startDate": "2026-04-01", "endDate": "2026-04-03", "budget": 500, "interests": ["food", "culture"], "pace": "moderate", "groupSize": 2}}),
    ("GET", "/api/intel/itinerary/test-itinerary-id", {}),
    ("POST", "/api/intel/recommend/ncf", {"json": {"userId": "user-1", "limit": 3}}),
    ("POST", "/api/intel/recommend/spots", {"json": {"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 3}}),
    ("POST", "/api/intel/recommend/similar/spot-2", {"json": {"limit": 2}}),
    ("POST", "/api/intel/vibe-match", {"json": {"description": "I want a chill outdoor walk with sunset views", "limit": 2}}),
    ("POST", "/api/intel/route/optimize", {"json": {"spots": [{"spotId": "spot-1", "latitude": 32.7555, "longitude": -97.3308}, {"spotId": "spot-2", "latitude": 32.7489, "longitude": -97.3623}], "startLat": 32.7555, "startLng": -97.3308}}),
    ("POST", "/api/intel/agent/plan-trip", {"json": {"prompt": "Plan a quick coffee walk in Fort Worth"}}),
    ("GET", "/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", {}),
    ("GET", "/api/intel/geocode?q=Fort%20Worth%2C%20TX", {}),
    ("GET", "/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308", {}),
]


@pytest.mark.parametrize(("method", "path", "kwargs"), PROTECTED_ROUTE_CASES)
def test_protected_routes_require_auth(client, method, path, kwargs):
    response = client.open(path, method=method, **kwargs)

    assert response.status_code == 401
    payload = response.get_json()["error"]
    assert payload["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize(("method", "path", "kwargs"), PROTECTED_ROUTE_CASES)
def test_protected_routes_reject_invalid_bearer_token(client, method, path, kwargs):
    response = client.open(path, method=method, headers={"Authorization": "Bearer invalid.jwt.token"}, **kwargs)

    assert response.status_code == 401
    payload = response.get_json()["error"]
    assert payload["code"] == "UNAUTHORIZED"


def test_route_map_marks_all_protected_endpoints_with_require_auth(app):
    protected_rules = [
        rule
        for rule in app.url_map.iter_rules()
        if rule.rule.startswith("/api/intel") and rule.rule not in PUBLIC_ROUTE_EXCEPTIONS
    ]
    assert protected_rules

    for rule in protected_rules:
        view_function = app.view_functions[rule.endpoint]
        assert getattr(view_function, "_scope_require_auth", False), f"{rule.rule} is missing @require_auth"

    assert not getattr(app.view_functions["health.health"], "_scope_require_auth", False)
