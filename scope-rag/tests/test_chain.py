import httpx

from app import chain


def test_ask_returns_fallback_when_no_results(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])

    result = chain.ask("What are the best sunset spots?")

    assert result["sources"] == []
    assert result["context_docs_used"] == 0
    assert "couldn't find any relevant information" in result["answer"]


def test_ask_no_result_fallback_stays_unique_when_repeated(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])

    previous_answer = "I couldn't find any relevant information in Scope to answer that question. Try being more specific about the location or type of experience you're looking for."

    result = chain.ask(
        "yo",
        conversation=[
            {"role": "user", "text": "yo"},
            {"role": "assistant", "text": previous_answer},
        ],
    )

    assert result["answer"] != previous_answer
    assert "Next move" in result["answer"]


def test_ask_marks_near_duplicate_answers_with_next_move(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])

    previous_answer = (
        "That is outside Scope trip and app help, so I will keep it professional. "
        "I am best for routes, spots, budgets, timing, photos, search, notifications, and how to use Scope."
    )

    result = chain.ask(
        "tell me a joke about astronauts",
        conversation=[
            {"role": "assistant", "text": previous_answer},
        ],
    )

    assert result["answer"] != previous_answer
    assert "Next move" in result["answer"]


def test_ask_handles_ai_personal_question_professionally(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("search should not run")))
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("app catalog should not run")))

    result = chain.ask("are u gay")

    assert result["sources"] == []
    assert result["context_docs_used"] == 0
    assert "sexual orientation" in result["answer"]
    assert "Scope AI" in result["answer"]


def test_ask_redirects_off_topic_general_question(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("search should not run")))
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("app catalog should not run")))

    result = chain.ask("what is the capital of France")

    assert result["sources"] == []
    assert result["context_docs_used"] == 0
    assert "outside Scope trip and app help" in result["answer"]


def test_ask_redirects_basic_non_scope_chat_back_to_app_help(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("search should not run")))
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("app catalog should not run")))

    result = chain.ask("tell me a joke about astronauts")

    assert result["sources"] == []
    assert result["context_docs_used"] == 0
    assert "outside Scope trip and app help" in result["answer"]
    assert "routes, spots, budgets" in result["answer"]


def test_ask_returns_structured_answer(monkeypatch):
    monkeypatch.setattr(
        chain,
        "search",
        lambda *args, **kwargs: [
            {
                "text": "Visitors say the skyline views are incredible at dusk.",
                "metadata": {"spot_name": "Twin Peaks", "spot_id": "spot-1", "rating": 4.8},
                "score": 0.02,
            }
        ],
    )

    class FakeChain:
        def __ror__(self, other):
            return self

        def __or__(self, other):
            return self

        def invoke(self, question: str) -> str:
            return "Twin Peaks is the strongest sunset option based on the available Scope context."

    class FakePromptTemplate:
        @staticmethod
        def from_messages(messages):
            return FakeChain()

    monkeypatch.setattr(chain, "ChatPromptTemplate", FakePromptTemplate)
    monkeypatch.setattr(chain, "get_llm", lambda: object())
    monkeypatch.setattr(chain, "StrOutputParser", lambda: object())

    result = chain.ask("What are the best sunset spots?")

    assert result["answer"].startswith("Twin Peaks")
    assert result["context_docs_used"] == 1
    assert result["sources"][0]["spot_name"] == "Twin Peaks"


def test_ask_prefers_gemini_when_key_is_configured(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-test")
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        chain,
        "search",
        lambda *args, **kwargs: [
            {
                "text": "Scope AI opens from the /trips/new route.",
                "metadata": {"source": "app_catalog", "source_type": "frontend_route", "title": "AI trip planner", "path": "/trips/new"},
                "score": 0.01,
            }
        ],
    )
    monkeypatch.setattr(chain, "_generate_with_gemini", lambda question, context, recent_chat: ("Gemini answered from Scope context.", "gemini-test"))
    monkeypatch.setattr(chain, "_generate_with_ollama", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("Ollama should not run")))

    result = chain.ask("Which frontend route opens Scope AI?")

    assert result["answer"] == "Gemini answered from Scope context."
    assert result["model"] == "gemini-test"


def test_ask_auto_falls_back_to_ollama_when_gemini_fails(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-test")
    monkeypatch.setattr(chain.settings, "ollama_model", "llama3.2:3b")
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        chain,
        "search",
        lambda *args, **kwargs: [
            {
                "text": "Scope AI opens from the /trips/new route.",
                "metadata": {"source": "app_catalog", "source_type": "frontend_route", "title": "AI trip planner", "path": "/trips/new"},
                "score": 0.01,
            }
        ],
    )
    monkeypatch.setattr(chain, "_generate_with_gemini", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("quota")))
    monkeypatch.setattr(chain, "_generate_with_ollama", lambda question, context, recent_chat: "Ollama fallback answered.")

    result = chain.ask("Which frontend route opens Scope AI?")

    assert result["answer"] == "Ollama fallback answered."
    assert result["model"] == "llama3.2:3b"


def test_gemini_generation_tries_model_fallback_on_retryable_error(monkeypatch):
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "gemini-backup")

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict | None = None):
            self.status_code = status_code
            self._payload = payload or {}

        def raise_for_status(self):
            if self.status_code >= 400:
                request = httpx.Request("POST", "https://example.test")
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("failed", request=request, response=response)

        def json(self):
            return self._payload

    calls: list[str] = []

    def fake_post(url, **kwargs):
        calls.append(url)
        if "gemini-primary" in url:
            return FakeResponse(503)
        return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": "Fallback Gemini answered."}]}}]})

    monkeypatch.setattr(chain.httpx, "post", fake_post)

    answer, model = chain._generate_with_gemini("question", "context", "No prior chat.")

    assert answer == "Fallback Gemini answered."
    assert model == "gemini-backup"
    assert len(calls) == 2


def test_gemini_generation_sends_inline_images(monkeypatch):
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "")

    captured = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "That looks like a scenic overlook."}]}}]}

    def fake_post(url, **kwargs):
        captured["payload"] = kwargs["json"]
        return FakeResponse()

    monkeypatch.setattr(chain.httpx, "post", fake_post)

    answer, model = chain._generate_with_gemini(
        "What can Scope learn from this photo?",
        "No retrieved Scope source context.",
        "No prior chat.",
        images=[
            {
                "filename": "lookout.png",
                "mime_type": "image/png",
                "data": "YXRsYXM=",
            }
        ],
    )

    parts = captured["payload"]["contents"][0]["parts"]
    assert answer == "That looks like a scenic overlook."
    assert model == "gemini-primary"
    assert parts[0]["inline_data"] == {"mime_type": "image/png", "data": "YXRsYXM="}
    assert "lookout.png" in parts[1]["text"]


def test_scope_ai_chat_sends_inline_images_to_gemini(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-primary")
    monkeypatch.setattr(chain.settings, "gemini_fallback_models", "")

    captured = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "The image fits a scenic route stop."}]}}]}

    def fake_post(url, **kwargs):
        captured["payload"] = kwargs["json"]
        return FakeResponse()

    monkeypatch.setattr(chain.httpx, "post", fake_post)

    result = chain.scope_ai_chat(
        system_prompt="You are Scope AI. {context} {recent_chat}",
        planner_state={"start": "Dallas", "end": "Austin"},
        session_history=[],
        preferences={},
        message="Review this image for my trip.",
        images=[{"filename": "lookout.png", "mime_type": "image/png", "data": "YXRsYXM="}],
    )

    parts = captured["payload"]["contents"][0]["parts"]
    assert result == {"response": "The image fits a scenic route stop.", "model": "gemini-primary"}
    assert parts[0]["inline_data"] == {"mime_type": "image/png", "data": "YXRsYXM="}
    assert "lookout.png" in parts[1]["text"]


def test_ask_inspects_images_even_without_retrieved_context(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(chain.settings, "gemini_model", "gemini-test")
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])

    captured = {}

    def fake_generate(question: str, context: str, recent_chat: str, images=None):
        captured["context"] = context
        captured["images"] = images
        return "The image looks useful as a scenic spot photo for Scope.", "gemini-test"

    monkeypatch.setattr(chain, "_generate_answer", fake_generate)

    result = chain.ask(
        "What can Scope learn from this photo?",
        images=[{"filename": "trail.webp", "mime_type": "image/webp", "data": "YXRsYXM="}],
    )

    assert "No retrieved Scope source context" in captured["context"]
    assert captured["images"][0]["filename"] == "trail.webp"
    assert result["answer"].startswith("The image looks useful")
    assert result["context_docs_used"] == 0


def test_ask_does_not_fake_image_understanding_without_gemini(monkeypatch):
    monkeypatch.setattr(chain.settings, "scope_ai_provider", "auto")
    monkeypatch.setattr(chain.settings, "gemini_api_key", "")
    monkeypatch.setattr(chain.settings, "ollama_model", "llama3.2:3b")
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: [])
    monkeypatch.setattr(chain, "_generate_with_ollama", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("text fallback should not inspect images")))

    result = chain.ask(
        "What is in this image?",
        images=[{"filename": "spot.jpg", "mime_type": "image/jpeg", "data": "YXRsYXM="}],
    )

    assert "enable Gemini" in result["answer"]
    assert result["model"] == "llama3.2:3b"


def test_ask_blocks_off_topic_image_homework(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("search should not run")))
    monkeypatch.setattr(chain.app_catalog, "search_app_knowledge", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("app catalog should not run")))

    result = chain.ask(
        "solve this equation from the image",
        images=[{"filename": "homework.png", "mime_type": "image/png", "data": "YXRsYXM="}],
    )

    assert "outside Scope" in result["answer"]
    assert result["sources"] == []


def test_ask_uses_app_catalog_for_route_questions(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])

    class FakeChain:
        def __ror__(self, other):
            return self

        def __or__(self, other):
            return self

        def invoke(self, question: str) -> str:
            return "Use /trips/new for Scope AI. That is the private planner route with the assistant panel."

    class FakePromptTemplate:
        @staticmethod
        def from_messages(messages):
            return FakeChain()

    monkeypatch.setattr(chain, "ChatPromptTemplate", FakePromptTemplate)
    monkeypatch.setattr(chain, "get_llm", lambda: object())
    monkeypatch.setattr(chain, "StrOutputParser", lambda: object())

    result = chain.ask("Which frontend route opens Scope AI?", top_k=4)

    assert "/trips/new" in result["answer"]
    assert result["context_docs_used"] > 0
    assert result["sources"][0]["source"] == "app_catalog"


def test_ask_answers_app_navigation_questions_from_catalog(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])

    captured = {}

    def fake_generate(question: str, context: str, recent_chat: str, images=None):
        captured["context"] = context
        return "Create a trip from /trips/new. That page opens the private AI trip planner for destination, dates, budget, pace, vibes, and itinerary generation.", "gemini-test"

    monkeypatch.setattr(chain, "_generate_answer", fake_generate)

    result = chain.ask("Where do I create a trip?", top_k=6)

    assert "/trips/new" in captured["context"]
    assert "/trips/new" in result["answer"]
    assert any(source["path"] == "/trips/new" for source in result["sources"])


def test_ask_explains_ollama_as_memory_and_fallback_use_case(monkeypatch):
    monkeypatch.setattr(chain, "search", lambda *args, **kwargs: [])

    captured = {}

    def fake_generate(question: str, context: str, recent_chat: str, images=None):
        captured["context"] = context
        return "Ollama powers local embeddings for private RAG memory and gives Scope an offline fallback model when Gemini is unavailable.", "gemini-test"

    monkeypatch.setattr(chain, "_generate_answer", fake_generate)

    result = chain.ask("What does Ollama do for Scope?", top_k=8)

    assert "local embeddings" in captured["context"]
    assert "offline fallback" in captured["context"]
    assert "local embeddings" in result["answer"]
    assert "offline fallback" in result["answer"]
