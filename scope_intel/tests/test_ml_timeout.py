import time

from app import create_app
from app.api import recommendations as recommendations_module
from app.api import vibe as vibe_module
from app.ml.runtime import MlComputationTimeoutError
from tests.conftest import TEST_JWT_AUDIENCE, TEST_JWT_ISSUER, TEST_JWT_SECRET, TEST_SECRET_KEY


def build_low_timeout_app(timeout_seconds: float = 0.01):
    return create_app(
        {
            "TESTING": True,
            "SECRET_KEY": TEST_SECRET_KEY,
            "JWT_SECRET": TEST_JWT_SECRET,
            "JWT_ISSUER": TEST_JWT_ISSUER,
            "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
            "FRONTEND_ORIGIN": "https://scope-frontend.example",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": 9999,
            "ML_REQUEST_TIMEOUT_SECONDS": timeout_seconds,
        }
    )


def test_recommend_spots_returns_timeout_error_when_ml_computation_exceeds_limit(auth_header, monkeypatch):
    app = build_low_timeout_app()
    client = app.test_client()

    def sleepy_recommend(*_args, **_kwargs):
        time.sleep(0.05)
        return []

    monkeypatch.setattr(recommendations_module.engine, "recommend_spots", sleepy_recommend)

    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 3},
        headers=auth_header,
    )

    assert response.status_code == 503
    error = response.get_json()["error"]
    assert error["code"] == "ML_TIMEOUT"
    assert error["message"] == "ML computation timed out"
    assert error["details"] == [{"field": "recommend_spots", "message": "Exceeded 0.010s timeout"}]


def test_vibe_match_returns_timeout_error_when_ml_computation_exceeds_limit(auth_header, monkeypatch):
    app = build_low_timeout_app()
    client = app.test_client()

    def sleepy_match(*_args, **_kwargs):
        time.sleep(0.05)
        return []

    monkeypatch.setattr(vibe_module.matcher, "match", sleepy_match)

    response = client.post(
        "/api/intel/vibe-match",
        json={"description": "I want a chill outdoor walk with sunset views", "limit": 2},
        headers=auth_header,
    )

    assert response.status_code == 503
    error = response.get_json()["error"]
    assert error["code"] == "ML_TIMEOUT"
    assert error["message"] == "ML computation timed out"
    assert error["details"] == [{"field": "vibe_match", "message": "Exceeded 0.010s timeout"}]


def test_similar_spots_returns_timeout_error_when_ml_computation_exceeds_limit(auth_header, monkeypatch):
    app = build_low_timeout_app()
    client = app.test_client()

    def force_timeout(_operation, _fn, *_args, **_kwargs):
        raise MlComputationTimeoutError("similar_spots", 0.01)

    monkeypatch.setattr(recommendations_module, "run_ml_with_timeout", force_timeout)

    response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 2}, headers=auth_header)

    assert response.status_code == 503
    error = response.get_json()["error"]
    assert error["code"] == "ML_TIMEOUT"
    assert error["message"] == "ML computation timed out"
    assert error["details"] == [{"field": "similar_spots", "message": "Exceeded 0.010s timeout"}]
