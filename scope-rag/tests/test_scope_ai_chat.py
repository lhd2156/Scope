from fastapi.testclient import TestClient
import jwt

from app.config import settings
from app.main import app
from app.security import reset_rate_limit_state

client = TestClient(app)
TEST_JWT_SECRET = "scope-rag-test-jwt-secret"


def auth_headers() -> dict[str, str]:
    token = jwt.encode(
        {"sub": "user-1", "iss": settings.core_jwt_issuer, "aud": settings.core_jwt_audience},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def setup_function():
    settings.core_jwt_secret = TEST_JWT_SECRET
    settings.rag_rate_limit_redis_url = ""
    settings.rag_rate_limit_enabled = True
    settings.rag_rate_limit_per_minute = 60
    settings.rag_generation_rate_limit_per_minute = 10
    settings.rag_ingest_rate_limit_per_minute = 5
    reset_rate_limit_state()


def valid_scope_ai_payload() -> dict:
    return {
        "system_prompt": "You are Scope AI and you return route actions.",
        "planner_state": {"start": "Dallas", "end": None, "stops": []},
        "session_history": [{"role": "user", "content": "start in Dallas"}],
        "preferences": {"preferred_types": ["food"]},
        "message": "Add a lunch stop",
    }


def test_scope_ai_chat_returns_200(monkeypatch):
    captured = {}

    def fake_scope_ai_chat(system_prompt, planner_state, session_history, preferences, message, images=None):
        captured["system_prompt"] = system_prompt
        captured["planner_state"] = planner_state
        captured["session_history"] = session_history
        captured["preferences"] = preferences
        captured["message"] = message
        captured["images"] = images
        return {"response": "test", "model": "gemini-test"}

    monkeypatch.setattr("app.routes.chain.scope_ai_chat", fake_scope_ai_chat)

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=valid_scope_ai_payload())

    assert response.status_code == 200
    assert response.json() == {"response": "test", "model": "gemini-test"}
    assert captured["planner_state"]["start"] == "Dallas"
    assert captured["message"] == "Add a lunch stop"
    assert captured["images"] == []


def test_scope_ai_chat_accepts_valid_images(monkeypatch):
    captured = {}

    def fake_scope_ai_chat(system_prompt, planner_state, session_history, preferences, message, images=None):
        captured["images"] = images
        return {"response": "The photo looks useful for the route.", "model": "gemini-test"}

    monkeypatch.setattr("app.routes.chain.scope_ai_chat", fake_scope_ai_chat)

    payload = valid_scope_ai_payload()
    payload["message"] = "Review this image for my trip."
    payload["images"] = [
        {
            "filename": "lookout.png",
            "mime_type": "image/png",
            "data": "YXRsYXM=",
        }
    ]

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=payload)

    assert response.status_code == 200
    assert captured["images"][0]["filename"] == "lookout.png"
    assert captured["images"][0]["mime_type"] == "image/png"


def test_scope_ai_chat_rejects_unsupported_images():
    payload = valid_scope_ai_payload()
    payload["images"] = [
        {
            "filename": "animated.gif",
            "mime_type": "image/gif",
            "data": "YXRsYXM=",
        }
    ]

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=payload)

    assert response.status_code == 422


def test_scope_ai_chat_rejects_empty_message():
    payload = valid_scope_ai_payload()
    payload["message"] = ""

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=payload)

    assert response.status_code == 422


def test_scope_ai_chat_rejects_missing_system_prompt():
    payload = valid_scope_ai_payload()
    payload.pop("system_prompt")

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=payload)

    assert response.status_code == 422


def test_scope_ai_chat_handles_generation_failure(monkeypatch):
    def fake_scope_ai_chat(*args, **kwargs):
        raise RuntimeError("provider offline")

    monkeypatch.setattr("app.routes.chain.scope_ai_chat", fake_scope_ai_chat)

    response = client.post("/api/rag/scope-ai", headers=auth_headers(), json=valid_scope_ai_payload())

    assert response.status_code == 500
    assert "Scope AI generation failed" in response.json()["detail"]
