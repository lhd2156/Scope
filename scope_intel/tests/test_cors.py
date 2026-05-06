import pytest
from app import create_app

TEST_SECRET_KEY = "scope-intel-test-secret"
TEST_JWT_SECRET = "scope-intel-test-jwt-secret"
TEST_JWT_ISSUER = "scope-core"
TEST_JWT_AUDIENCE = "scope-frontend"
PRODUCTION_FRONTEND_ORIGIN = "https://scope-frontend.example"
LOCALHOST_FRONTEND_ORIGIN = "http://localhost:5173"


def build_app(*, flask_env: str, frontend_origin: str | None):
    return create_app(
        {
            "TESTING": flask_env != "production",
            "FLASK_ENV": flask_env,
            "SECRET_KEY": TEST_SECRET_KEY,
            "JWT_SECRET": TEST_JWT_SECRET,
            "JWT_ISSUER": TEST_JWT_ISSUER,
            "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
            "FRONTEND_ORIGIN": frontend_origin,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": 9999,
        }
    )


def test_cors_allows_configured_frontend_origin_in_production_preflight():
    app = build_app(flask_env="production", frontend_origin=PRODUCTION_FRONTEND_ORIGIN)
    client = app.test_client()

    response = client.options(
        "/api/intel/itinerary/generate",
        headers={
            "Origin": PRODUCTION_FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_FRONTEND_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert "POST" in response.headers["Access-Control-Allow-Methods"]
    assert "Authorization" in response.headers["Access-Control-Allow-Headers"]
    assert "Content-Type" in response.headers["Access-Control-Allow-Headers"]


def test_cors_rejects_localhost_origin_in_production():
    app = build_app(flask_env="production", frontend_origin=PRODUCTION_FRONTEND_ORIGIN)
    client = app.test_client()

    response = client.options(
        "/api/intel/itinerary/generate",
        headers={
            "Origin": LOCALHOST_FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers


def test_cors_allows_localhost_in_development():
    app = build_app(flask_env="development", frontend_origin=PRODUCTION_FRONTEND_ORIGIN)
    client = app.test_client()

    response = client.options(
        "/api/intel/itinerary/generate",
        headers={
            "Origin": LOCALHOST_FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == LOCALHOST_FRONTEND_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


def test_cors_headers_apply_to_unauthorized_api_responses():
    app = build_app(flask_env="production", frontend_origin=PRODUCTION_FRONTEND_ORIGIN)
    client = app.test_client()

    response = client.get(
        "/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01",
        headers={"Origin": PRODUCTION_FRONTEND_ORIGIN},
    )

    assert response.status_code == 401
    assert response.headers["Access-Control-Allow-Origin"] == PRODUCTION_FRONTEND_ORIGIN
    assert response.headers["Access-Control-Allow-Credentials"] == "true"


def test_production_cors_requires_frontend_origin_configuration():
    with pytest.raises(RuntimeError, match="FRONTEND_ORIGIN"):
        build_app(flask_env="production", frontend_origin=None)
