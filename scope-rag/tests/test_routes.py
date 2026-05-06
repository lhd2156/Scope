from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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
            "model": "gemini-2.5-flash-lite",
            "context_docs_used": 0,
        }

    monkeypatch.setattr("app.routes.chain.ask", fake_ask)

    response = client.post(
        "/api/rag/ask",
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
        json={"id": "doc-1", "text": "A lovely lookout", "metadata": {"spot_name": "Twin Peaks"}},
    )

    assert response.status_code == 200
    assert captured["id"] == "doc-1"


def test_health_route(monkeypatch):
    monkeypatch.setattr("app.routes.vectorstore.get_vector_count", lambda: 3)
    monkeypatch.setattr("app.routes.chain.active_model_name", lambda: "gemini-2.5-flash-lite")
    monkeypatch.setattr("app.routes.settings.gemini_api_key", "test-key")

    response = client.get("/api/rag/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["vector_count"] == 3
    assert payload["app_catalog_count"] > 0
    assert payload["chat_provider"] == "gemini"
    assert payload["chat_model"] == "gemini-2.5-flash-lite"
    assert payload["embedding_provider"] == "ollama"
    assert payload["local_fallback_model"] == "llama3.2:3b"
    assert payload["vision_enabled"] is True
    assert payload["vision_model"] == "gemini-2.5-flash-lite"


def test_app_knowledge_route():
    response = client.get("/api/rag/app-knowledge")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] > 0
    assert any(doc["metadata"]["source_type"] == "frontend_routes_index" for doc in payload["documents"])


def test_search_route_includes_app_knowledge_when_vectors_fail(monkeypatch):
    monkeypatch.setattr("app.routes.vectorstore.search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))

    response = client.get("/api/rag/search", params={"q": "What route opens Scope AI?", "k": 5})

    assert response.status_code == 200
    assert any(result["metadata"]["source"] == "app_catalog" for result in response.json()["results"])
