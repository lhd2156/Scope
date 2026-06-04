from fastapi.testclient import TestClient
import jwt

from app.config import settings
from app.main import app
from app.security import reset_rate_limit_state

client = TestClient(app)
TEST_JWT_SECRET = "scope-rag-test-jwt-secret"
ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"


def auth_headers(role: str = "user") -> dict[str, str]:
    token = jwt.encode(
        {
            "sub": "user-1",
            "iss": settings.core_jwt_issuer,
            "aud": settings.core_jwt_audience,
            ROLE_CLAIM: role,
        },
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
    settings.rag_ingest_required_role = "admin"
    reset_rate_limit_state()


def test_ask_route(monkeypatch):
    captured = {}

    def fake_ask(question, filters=None, top_k=None, conversation=None, images=None):
        captured["conversation"] = conversation
        captured["images"] = images
        return {
            "answer": "A concise answer",
            "sources": [{"spot_name": "Ocean Beach"}],
            "model": "llama3.1",
            "context_docs_used": 1,
        }

    monkeypatch.setattr(
        "app.routes.chain.ask",
        fake_ask,
    )

    response = client.post(
        "/api/rag/ask",
        headers=auth_headers(),
        json={
            "question": "Best beach views?",
            "conversation": [
                {"role": "user", "text": "Best beach views?"},
                {"role": "assistant", "text": "A prior answer"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["model"] == "llama3.1"
    assert captured["conversation"][1]["text"] == "A prior answer"
    assert captured["images"] == []


def test_ask_route_accepts_valid_images(monkeypatch):
    captured = {}

    def fake_ask(question, filters=None, top_k=None, conversation=None, images=None):
        captured["images"] = images
        return {
            "answer": "The photo can become a scenic Scope spot.",
            "sources": [],
            "model": "gemini-2.5-flash",
            "context_docs_used": 0,
        }

    monkeypatch.setattr("app.routes.chain.ask", fake_ask)

    response = client.post(
        "/api/rag/ask",
        headers=auth_headers(),
        json={
            "question": "What can Scope learn from this photo?",
            "images": [
                {
                    "filename": "lookout.png",
                    "mime_type": "image/png",
                    "data": "YXRsYXM=",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert captured["images"][0]["filename"] == "lookout.png"
    assert captured["images"][0]["mime_type"] == "image/png"


def test_ask_route_rejects_unsupported_images():
    response = client.post(
        "/api/rag/ask",
        headers=auth_headers(),
        json={
            "question": "What can Scope learn from this photo?",
            "images": [
                {
                    "filename": "animated.gif",
                    "mime_type": "image/gif",
                    "data": "YXRsYXM=",
                }
            ],
        },
    )

    assert response.status_code == 422


def test_ingest_route(monkeypatch):
    captured = {}

    def fake_add_document(doc_id: str, text: str, metadata: dict) -> None:
        captured["id"] = doc_id
        captured["text"] = text
        captured["metadata"] = metadata

    monkeypatch.setattr("app.routes.vectorstore.add_document", fake_add_document)

    response = client.post(
        "/api/rag/ingest",
        headers=auth_headers(role="admin"),
        json={"id": "doc-1", "text": "A lovely lookout", "metadata": {"spot_name": "Twin Peaks"}},
    )

    assert response.status_code == 200
    assert captured["id"] == "doc-1"


def test_ingest_route_requires_admin_role(monkeypatch):
    monkeypatch.setattr("app.routes.vectorstore.add_document", lambda *args, **kwargs: None)

    response = client.post(
        "/api/rag/ingest",
        headers=auth_headers(role="user"),
        json={"id": "doc-1", "text": "A lovely lookout", "metadata": {"spot_name": "Twin Peaks"}},
    )

    assert response.status_code == 403


def test_health_route(monkeypatch):
    monkeypatch.setattr("app.routes.vectorstore.get_vector_count", lambda: 3)
    monkeypatch.setattr("app.routes.chain.active_model_name", lambda: "gemini-2.5-flash")
    monkeypatch.setattr("app.routes.settings.gemini_api_key", "test-key")

    response = client.get("/api/rag/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["vector_count"] == 3
    assert payload["app_catalog_count"] > 0
    assert payload["chat_provider"] == "gemini"
    assert payload["chat_model"] == "gemini-2.5-flash"
    assert payload["embedding_provider"] == "ollama"
    assert payload["local_fallback_model"] == "llama3.2:3b"
    assert payload["vision_enabled"] is True
    assert payload["vision_model"] == "gemini-2.5-flash"


def test_app_knowledge_route():
    response = client.get("/api/rag/app-knowledge", headers=auth_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] > 0
    assert any(doc["metadata"]["source_type"] == "frontend_routes_index" for doc in payload["documents"])


def test_search_route_includes_app_knowledge_when_vectors_fail(monkeypatch):
    monkeypatch.setattr("app.routes.vectorstore.search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))

    response = client.get("/api/rag/search", headers=auth_headers(), params={"q": "What route opens Scope AI?", "k": 5})

    assert response.status_code == 200
    assert any(result["metadata"]["source"] == "app_catalog" for result in response.json()["results"])


def test_search_requires_auth():
    response = client.get("/api/rag/search", params={"q": "What route opens Scope AI?", "k": 5})

    assert response.status_code == 401


def test_search_rejects_unbounded_k():
    response = client.get("/api/rag/search", headers=auth_headers(), params={"q": "What route opens Scope AI?", "k": 500})

    assert response.status_code == 422


def test_generation_routes_are_rate_limited(monkeypatch):
    settings.rag_generation_rate_limit_per_minute = 1
    monkeypatch.setattr(
        "app.routes.chain.ask",
        lambda *args, **kwargs: {
            "answer": "A concise answer",
            "sources": [],
            "model": "llama3.1",
            "context_docs_used": 0,
        },
    )

    first_response = client.post("/api/rag/ask", headers=auth_headers(), json={"question": "Best beach views?"})
    second_response = client.post("/api/rag/ask", headers=auth_headers(), json={"question": "Best beach views?"})

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.headers["Retry-After"] == "60"
