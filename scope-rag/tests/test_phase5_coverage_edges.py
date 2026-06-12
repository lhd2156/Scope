import importlib
import sys
import types
from types import SimpleNamespace

import pytest

from app import app_catalog, chain, ingestion, vectorstore
from app.config import settings
from tests.test_routes import auth_headers, client


def test_main_sentry_float_env_clamps_invalid_values_and_startup_logs(monkeypatch):
    calls = []
    fake_sentry = SimpleNamespace(init=lambda **kwargs: calls.append(kwargs))

    monkeypatch.setitem(sys.modules, "sentry_sdk", fake_sentry)
    monkeypatch.setenv("SENTRY_DSN", "https://public@example.test/1")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "not-a-number")
    monkeypatch.setenv("SENTRY_PROFILES_SAMPLE_RATE", "3.5")
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "phase5")
    monkeypatch.setenv("SENTRY_RELEASE", "")

    import app.main as main

    reloaded = importlib.reload(main)

    assert calls[-1]["traces_sample_rate"] == 0.1
    assert calls[-1]["profiles_sample_rate"] == 1.0
    assert calls[-1]["environment"] == "phase5"
    assert calls[-1]["release"] is None

    import anyio

    anyio.run(reloaded.startup)


def test_main_skips_sentry_when_dependency_is_absent(monkeypatch):
    import app.main as main

    monkeypatch.setenv("SENTRY_DSN", "https://public@example.test/1")
    monkeypatch.setattr(main, "sentry_sdk", None)

    reloaded = importlib.reload(main)

    assert reloaded.sentry_dsn == "https://public@example.test/1"


def test_chain_singleton_llm_and_provider_error_edges(monkeypatch):
    created = []

    class FakeChatOllama:
        def __init__(self, **kwargs):
            created.append(kwargs)

    monkeypatch.setitem(sys.modules, "langchain_ollama", SimpleNamespace(ChatOllama=FakeChatOllama))
    monkeypatch.setattr(chain, "_llm", None)
    monkeypatch.setattr(chain.settings, "ollama_model", "llama-edge")
    monkeypatch.setattr(chain.settings, "temperature", 0.2)
    monkeypatch.setattr(chain.settings, "ollama_base_url", "http://ollama.edge")
    monkeypatch.setattr(chain.settings, "ollama_num_ctx", 4096)
    monkeypatch.setattr(chain.settings, "ollama_num_predict", 512)
    monkeypatch.setattr(chain.settings, "ollama_num_thread", 2)
    monkeypatch.setattr(chain.settings, "ollama_timeout_seconds", 7)

    first = chain.get_llm()
    assert chain.get_llm() is first
    assert created == [
        {
            "model": "llama-edge",
            "temperature": 0.2,
            "base_url": "http://ollama.edge",
            "num_ctx": 4096,
            "num_predict": 512,
            "num_thread": 2,
            "client_kwargs": {"timeout": 7},
        }
    ]

    monkeypatch.setattr(chain.settings, "scope_ai_provider", "ollama")
    with pytest.raises(chain.ImageUnderstandingUnavailable):
        chain._generate_answer(
            "What can Scope learn from this image?",
            "No context",
            "No prior chat",
            images=[{"filename": "spot.jpg", "mime_type": "image/jpeg", "data": "abc"}],
        )

    monkeypatch.setattr(chain.settings, "scope_ai_provider", "gemini")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain, "_generate_with_gemini", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("quota")))
    with pytest.raises(RuntimeError, match="quota"):
        chain._generate_answer("Where next?", "context", "chat")


def test_chain_repeat_and_extractive_edge_branches():
    assert chain._answers_are_too_similar("", "nonempty") is False
    assert chain._format_recent_chat([{"role": "assistant", "text": "   "}]) == "No prior chat in this request."
    assert chain._ensure_unique_answer("   ", [{"role": "assistant", "text": "same"}], "Where next?") == "   "

    answer = chain._extractive_answer(
        [
            {
                "text": "Use Scope AI from the trip planner route.",
                "metadata": {
                    "source": "app_catalog",
                    "source_type": "api_route",
                    "method": "POST",
                    "path": "/api/rag/scope-ai",
                    "title": "Scope AI chat",
                },
            }
        ],
        conversation=None,
        question="Which API endpoint handles Scope AI?",
    )

    assert "POST /api/rag/scope-ai" in answer


def test_scope_ai_chat_gemini_provider_rethrows_model_failures(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "gemini")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "")
    monkeypatch.setattr(chain.httpx, "post", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("gemini down")))

    with pytest.raises(RuntimeError, match="gemini down"):
        chain.scope_ai_chat(
            system_prompt="You are Scope AI. {context} {recent_chat}",
            planner_state={},
            session_history=[],
            preferences={},
            message="Plan a route",
        )


def test_vectorstore_recovery_edges(monkeypatch, tmp_path):
    class FakeDateTime:
        @staticmethod
        def now(tz=None):
            return SimpleNamespace(strftime=lambda fmt: "20260101000000")

    persist_dir = tmp_path / "chroma"
    persist_dir.mkdir()
    (persist_dir / "chroma.sqlite3").write_text("old format", encoding="utf-8")
    existing_quarantine = tmp_path / "chroma.incompatible-20260101000000"
    existing_quarantine.mkdir()

    monkeypatch.setattr(vectorstore.settings, "chroma_persist_dir", str(persist_dir))
    monkeypatch.setattr(vectorstore, "datetime", FakeDateTime)

    target = vectorstore._quarantine_persist_dir()

    assert target == tmp_path / "chroma.incompatible-20260101000000-1"
    assert (target / "chroma.sqlite3").read_text(encoding="utf-8") == "old format"
    assert persist_dir.exists()

    missing_dir = tmp_path / "missing"
    monkeypatch.setattr(vectorstore.settings, "chroma_persist_dir", str(missing_dir))
    assert vectorstore._quarantine_persist_dir() is None
    assert missing_dir.exists()

    monkeypatch.setitem(
        sys.modules,
        "chromadb.api.client",
        SimpleNamespace(SharedSystemClient=SimpleNamespace(clear_system_cache=lambda: (_ for _ in ()).throw(RuntimeError("cache")))),
    )
    vectorstore._clear_chroma_system_cache()


def test_vectorstore_nonrecoverable_and_message_based_recovery(monkeypatch, tmp_path):
    attempts = []

    class FakeChroma:
        def __init__(self, **kwargs):
            attempts.append(kwargs)
            if len(attempts) == 1:
                raise RuntimeError("legacy configuration _type missing")
            self._collection = SimpleNamespace(count=lambda: 0)

    monkeypatch.setitem(sys.modules, "langchain_chroma", SimpleNamespace(Chroma=FakeChroma))
    monkeypatch.setattr(vectorstore, "_vectorstore", None)
    monkeypatch.setattr(vectorstore, "get_embeddings", lambda: "embeddings")
    monkeypatch.setattr(vectorstore, "_clear_chroma_system_cache", lambda: None)
    monkeypatch.setattr(vectorstore.settings, "chroma_collection_name", "scope-test")
    monkeypatch.setattr(vectorstore.settings, "chroma_persist_dir", str(tmp_path / "chroma"))

    assert vectorstore.get_vectorstore()._collection.count() == 0
    assert len(attempts) == 2

    monkeypatch.setattr(vectorstore, "_vectorstore", None)
    monkeypatch.setattr(vectorstore, "_create_vectorstore", lambda: (_ for _ in ()).throw(RuntimeError("disk full")))
    with pytest.raises(RuntimeError, match="disk full"):
        vectorstore.get_vectorstore()


def test_routes_validation_and_failure_edges(monkeypatch):
    settings.core_jwt_secret = "scope-rag-test-jwt-secret"

    invalid_image = client.post(
        "/api/rag/ask",
        headers=auth_headers(),
        json={
            "question": "What can Scope learn from this photo?",
            "images": [{"filename": "bad.png", "mime_type": "image/png", "data": "***"}],
        },
    )
    assert invalid_image.status_code == 422

    oversized = client.post(
        "/api/rag/ask",
        headers=auth_headers(),
        json={
            "question": "What can Scope learn from this photo?",
            "images": [{"filename": "big.png", "mime_type": "image/png", "data": "a" * 6_000_000}],
        },
    )
    assert oversized.status_code == 422

    monkeypatch.setattr("app.routes.chain.ask", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("model failed")))
    ask_failed = client.post("/api/rag/ask", headers=auth_headers(), json={"question": "Best route today?"})
    assert ask_failed.status_code == 500
    assert ask_failed.json()["detail"] == "model failed"

    monkeypatch.setattr("app.routes.vectorstore.search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("vectors down")))
    search_failed = client.get(
        "/api/rag/search",
        headers=auth_headers(),
        params={"q": "plain sunset spot", "include_app_catalog": False},
    )
    assert search_failed.status_code == 500
    assert search_failed.json()["detail"] == "vectors down"


def test_app_catalog_endpoint_query_and_ingestion_consumer(monkeypatch):
    endpoint_results = app_catalog.search_app_knowledge("Which API endpoint handles POST /api/rag/ask?", k=5)
    assert endpoint_results
    assert endpoint_results[0]["metadata"]["source_type"].startswith("api")

    constructed = []

    class FakeConsumer:
        def __init__(self, config):
            constructed.append(config)

    monkeypatch.setattr(ingestion, "Consumer", FakeConsumer)
    monkeypatch.setattr(ingestion.settings, "kafka_bootstrap_servers", "kafka:9092")

    assert isinstance(ingestion._build_consumer(), FakeConsumer)
    assert constructed == [
        {
            "bootstrap.servers": "kafka:9092",
            "group.id": "scope-rag",
            "auto.offset.reset": "latest",
        }
    ]
