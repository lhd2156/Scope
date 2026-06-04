import httpx
import pytest

from app import chain


def test_gemini_helpers_dedupe_encode_extract_and_format(monkeypatch):
    monkeypatch.setattr(chain.settings, "gemini_model", "models/gemini primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "gemini-backup, gemini-backup, ")
    monkeypatch.setattr(chain.settings, "gemini_base_url", "https://gemini.test/v1/")

    assert chain._gemini_model_names() == ["models/gemini primary", "gemini-backup"]
    assert chain._gemini_endpoint("models/gemini primary") == "https://gemini.test/v1/models/gemini%20primary:generateContent"
    assert chain._extract_gemini_text({"candidates": [{"content": {"parts": [{"text": "  first "}, {"text": "second"}]}}]}) == "first\nsecond"

    with pytest.raises(RuntimeError, match="no text"):
        chain._extract_gemini_text({"candidates": [{"content": {"parts": [{"text": ""}]}}]})

    assert chain._format_image_prompt("Where is this?", None) == "Where is this?"
    parts = chain._gemini_content_parts(
        "Where is this?",
        [{"filename": "trail.png", "mime_type": "image/png", "data": "abc"}],
    )
    assert parts[0] == {"inline_data": {"mime_type": "image/png", "data": "abc"}}
    assert "trail.png" in parts[1]["text"]


def test_gemini_generation_raises_non_retryable_status(monkeypatch):
    monkeypatch.setattr(chain.settings, "gemini_model", "primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "backup")

    request = httpx.Request("POST", "https://gemini.test")
    response = httpx.Response(400, request=request)

    def fake_generate(*args, **kwargs):
        raise httpx.HTTPStatusError("bad request", request=request, response=response)

    monkeypatch.setattr(chain, "_generate_with_gemini_model", fake_generate)

    with pytest.raises(httpx.HTTPStatusError):
        chain._generate_with_gemini("question", "context", "chat")


def test_gemini_generation_reports_all_timeouts(monkeypatch):
    monkeypatch.setattr(chain.settings, "gemini_model", "primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "backup")
    monkeypatch.setattr(chain, "_generate_with_gemini_model", lambda *args, **kwargs: (_ for _ in ()).throw(httpx.TimeoutException("slow")))

    with pytest.raises(RuntimeError, match="primary:timeout, backup:timeout"):
        chain._generate_with_gemini("question", "context", "chat")


def test_professional_boundary_answer_covers_safety_abuse_sexual_regulated_and_empty():
    assert chain._professional_boundary_answer("") is None
    assert "988" in chain._professional_boundary_answer("I want to kill myself")
    assert "respectful" in chain._professional_boundary_answer("fuck you")
    assert "professional" in chain._professional_boundary_answer("send nudes")
    assert "qualified professional" in chain._professional_boundary_answer("give me medical advice")
    assert "outside Scope" in chain._professional_boundary_answer("write code from this image", has_images=True)
    assert chain._professional_boundary_answer("what restaurants should I visit in Austin") is None


def test_retrieve_context_merges_dedupes_and_tolerates_vector_failure(monkeypatch):
    app_doc = {
        "text": "Open the planner at /trips/new",
        "metadata": {"source": "app_catalog", "source_type": "frontend_route", "path": "/trips/new"},
        "score": 0.01,
    }
    duplicate_vector_doc = {
        "text": "Duplicate planner route",
        "metadata": {"source": "app_catalog", "source_type": "frontend_route", "path": "/trips/new"},
        "score": 0.02,
    }
    unique_vector_doc = {
        "text": "Twin Peaks has skyline views",
        "metadata": {"source": "spot", "spot_id": "spot-1", "spot_name": "Twin Peaks"},
        "score": 0.03,
    }

    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [app_doc])
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [duplicate_vector_doc, unique_vector_doc])

    results = chain._retrieve_context("planner", filters={"city": "SF"}, top_k=5)

    assert results == [app_doc, unique_vector_doc]

    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))
    assert chain._retrieve_context("planner", filters=None, top_k=5) == [app_doc]


def test_context_formatting_and_repeat_helpers():
    app_item = chain._format_context_item(
        1,
        {
            "text": "Planner route text",
            "metadata": {
                "source": "app_catalog",
                "source_type": "api_route",
                "method": "POST",
                "path": "/api/rag/ask",
                "service": "scope-rag",
            },
        },
    )
    content_item = chain._format_context_item(
        2,
        {
            "text": "Great skyline view",
            "metadata": {"spot_name": "Twin Peaks", "rating": 4.8, "source": "review"},
        },
    )

    assert "method=POST" in app_item
    assert "Scope content: Spot=Twin Peaks" in content_item
    assert chain._format_recent_chat(None) == "No prior chat in this request."
    assert "Scope AI:" in chain._format_recent_chat([{"role": "assistant", "text": " hello\nthere "}])
    assert chain._fresh_repeat_line("where do I click", 1).startswith("Next move 2")
    assert chain._answers_are_too_similar("short answer", "different short answer") is False


def test_ask_returns_extractive_answer_when_generation_fails(monkeypatch):
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        chain,
        "search",
        lambda *args, **kwargs: [
            {
                "text": "Twin Peaks is best near sunset.",
                "metadata": {"source": "spot", "spot_name": "Twin Peaks", "rating": 4.8},
                "score": 0.01,
            }
        ],
    )
    monkeypatch.setattr(chain, "_generate_answer", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("model offline")))

    result = chain.ask("Which Scope spot should I visit at sunset?")

    assert "Scope found relevant source material" in result["answer"]
    assert result["sources"][0]["spot_name"] == "Twin Peaks"


def test_ask_returns_image_failure_when_generation_crashes(monkeypatch):
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain, "_generate_answer", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("vision offline")))

    result = chain.ask(
        "What can Scope learn from this image?",
        images=[{"filename": "spot.jpg", "mime_type": "image/jpeg", "data": "abc"}],
    )

    assert "could not inspect" in result["answer"]
    assert result["context_docs_used"] == 0


def test_scope_ai_chat_uses_ollama_and_appends_context_when_placeholders_absent(monkeypatch):
    captured = {}

    class FakeChain:
        def __ror__(self, other):
            return self

        def __or__(self, other):
            return self

        def invoke(self, question):
            captured["question"] = question
            return "Local route response"

    class FakePromptTemplate:
        @staticmethod
        def from_messages(messages):
            captured["messages"] = messages
            return FakeChain()

    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "")
    monkeypatch.setattr(chain.settings, "ollama_model", "llama-local")
    monkeypatch.setattr(chain, "ChatPromptTemplate", FakePromptTemplate)
    monkeypatch.setattr(chain, "get_llm", lambda: object())
    monkeypatch.setattr(chain, "StrOutputParser", lambda: object())

    result = chain.scope_ai_chat(
        system_prompt="You are Scope AI.",
        planner_state={"start": "Dallas"},
        session_history=[{"role": "assistant", "content": "Pick dates."}, {"role": "user", "content": "Friday"}],
        preferences={"pace": "relaxed"},
        message="Add a lunch stop",
    )

    system_message = captured["messages"][0][1]
    assert "Current planner state" in system_message
    assert "Recent chat" in system_message
    assert captured["question"] == "Add a lunch stop"
    assert result == {"response": "Local route response", "model": "llama-local"}


def test_scope_ai_chat_returns_image_notice_without_gemini(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "")
    monkeypatch.setattr(chain.settings, "ollama_model", "llama-local")

    result = chain.scope_ai_chat(
        system_prompt="You are Scope AI. {context} {recent_chat}",
        planner_state={},
        session_history=[],
        preferences={},
        message="Review this photo",
        images=[{"filename": "spot.jpg", "mime_type": "image/jpeg", "data": "abc"}],
    )

    assert "describe what is visible" in result["response"]
    assert result["model"] == "llama-local"


def test_scope_ai_chat_auto_falls_back_to_ollama_when_gemini_models_fail(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "backup")
    monkeypatch.setattr(chain.settings, "ollama_model", "llama-local")
    monkeypatch.setattr(chain.httpx, "post", lambda *args, **kwargs: (_ for _ in ()).throw(httpx.TimeoutException("slow")))

    class FakeChain:
        def __ror__(self, other):
            return self

        def __or__(self, other):
            return self

        def invoke(self, question):
            return "Ollama route response"

    monkeypatch.setattr(chain.ChatPromptTemplate, "from_messages", lambda messages: FakeChain())
    monkeypatch.setattr(chain, "get_llm", lambda: object())
    monkeypatch.setattr(chain, "StrOutputParser", lambda: object())

    result = chain.scope_ai_chat(
        system_prompt="You are Scope AI. {context} {recent_chat}",
        planner_state={},
        session_history=[],
        preferences={},
        message="Plan a Scope route",
    )

    assert result == {"response": "Ollama route response", "model": "llama-local"}
