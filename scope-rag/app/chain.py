"""RAG chain - retrieval + LLM generation with grounded answers."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING
from urllib.parse import quote

import httpx
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

from app import app_catalog
from app.config import settings
from app.vectorstore import search

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_ollama import ChatOllama

_llm: ChatOllama | None = None

SYSTEM_PROMPT = """You are Scope AI, a knowledgeable assistant for the Scope adventure platform.
Answer the user's question using ONLY the context provided below. The context may include app navigation, API routes, architecture notes, service ownership, real user reviews, and spot descriptions from Scope.

Rules:
1. Only cite information present in the context. Do not fabricate or hallucinate.
2. If the context doesn't contain enough information, say so honestly.
3. Be specific. Mention route paths, HTTP methods, service names, spot names, ratings, and review details when present.
4. Keep answers concise but helpful (2-4 paragraphs max).
5. If asked for recommendations, rank them and explain why.
6. If asked about app or API routes, prefer a compact grouped list.
7. If asked where to find or do something in Scope, answer with the most relevant app page/path first, then one short sentence about what the page does.
8. Use the recent chat to avoid repeating yourself. Never send the exact same assistant answer that already appears in recent chat; repeated greetings or repeated questions still need fresh wording.
9. Stay professional on off-topic or provocative prompts. Personal identity, romantic, sexual, abusive, trivia, homework, code, news, medical, legal, financial, or emergency questions should be answered with a short boundary or redirect, then brought back to Scope trips/app help.
10. If image parts are attached, inspect only visible travel-relevant details: place type, scene, lighting, accessibility cues, safety cautions, photo quality, possible tags, and how it could fit a spot, route, or itinerary. Do not identify private people or infer sensitive traits.

Context:
{context}

Recent chat:
{recent_chat}
"""

ImageAttachment = dict[str, str]


class ImageUnderstandingUnavailable(RuntimeError):
    """Raised when a request needs image understanding but no vision model can run."""


def get_llm() -> ChatOllama:
    """Get a singleton Ollama chat client."""
    global _llm
    if _llm is None:
        from langchain_ollama import ChatOllama

        logger.info("Loading Ollama chat model=%s", settings.ollama_model)
        _llm = ChatOllama(
            model=settings.ollama_model,
            temperature=settings.temperature,
            base_url=settings.ollama_base_url,
            num_ctx=settings.ollama_num_ctx,
            num_predict=settings.ollama_num_predict,
            num_thread=settings.ollama_num_thread,
            client_kwargs={"timeout": settings.ollama_timeout_seconds},
        )
    return _llm


def _configured_provider() -> str:
    return settings.scope_ai_provider.strip().lower()


def _should_use_gemini() -> bool:
    provider = _configured_provider()
    return provider in {"auto", "gemini"} and bool(settings.gemini_api_key.strip())


def active_model_name() -> str:
    """Return the model Scope AI will report for this request."""
    if _should_use_gemini():
        return settings.gemini_model
    return settings.ollama_model


def _gemini_model_names() -> list[str]:
    configured = [
        settings.gemini_model,
        *settings.gemini_fallback_models.split(","),
    ]
    models: list[str] = []
    for model in configured:
        clean_model = model.strip()
        if clean_model and clean_model not in models:
            models.append(clean_model)
    return models


def _gemini_endpoint(model_name: str) -> str:
    model = model_name.removeprefix("models/")
    encoded_model = quote(model, safe="")
    base_url = settings.gemini_base_url.rstrip("/")
    return f"{base_url}/models/{encoded_model}:generateContent"


def _extract_gemini_text(payload: dict) -> str:
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(str(part.get("text") or "").strip() for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned no text")
    return text


def _format_image_prompt(question: str, images: list[ImageAttachment] | None) -> str:
    if not images:
        return question

    labels = []
    for index, image in enumerate(images, 1):
        filename = image.get("filename") or f"image {index}"
        labels.append(f"{index}. {filename} ({image.get('mime_type', 'image')})")

    return f"{question}\n\nAttached images in order:\n" + "\n".join(labels)


def _gemini_content_parts(question: str, images: list[ImageAttachment] | None) -> list[dict]:
    parts = [
        {
            "inline_data": {
                "mime_type": image["mime_type"],
                "data": image["data"],
            }
        }
        for image in images or []
    ]
    parts.append({"text": _format_image_prompt(question, images)})
    return parts


def _generate_with_gemini_model(
    model_name: str,
    question: str,
    context: str,
    recent_chat: str,
    images: list[ImageAttachment] | None = None,
) -> str:
    system_text = SYSTEM_PROMPT.format(context=context, recent_chat=recent_chat)
    response = httpx.post(
        _gemini_endpoint(model_name),
        params={"key": settings.gemini_api_key},
        json={
            "systemInstruction": {"parts": [{"text": system_text}]},
            "contents": [
                {
                    "role": "user",
                    "parts": _gemini_content_parts(question, images),
                }
            ],
            "generationConfig": {
                "temperature": settings.temperature,
                "maxOutputTokens": settings.gemini_max_output_tokens,
            },
        },
        timeout=settings.gemini_timeout_seconds,
    )
    response.raise_for_status()
    return _extract_gemini_text(response.json())


def _generate_with_gemini(
    question: str,
    context: str,
    recent_chat: str,
    images: list[ImageAttachment] | None = None,
) -> tuple[str, str]:
    retryable_statuses = {408, 429, 500, 502, 503, 504}
    failures: list[str] = []

    for model_name in _gemini_model_names():
        try:
            return _generate_with_gemini_model(model_name, question, context, recent_chat, images=images), model_name
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            failures.append(f"{model_name}:{status_code}")
            if status_code not in retryable_statuses:
                raise
            logger.warning("Gemini model %s failed with HTTP %s; trying fallback", model_name, status_code)
        except httpx.TimeoutException:
            failures.append(f"{model_name}:timeout")
            logger.warning("Gemini model %s timed out; trying fallback", model_name)

    raise RuntimeError(f"Gemini generation failed for configured models: {', '.join(failures)}")


def _generate_with_ollama(question: str, context: str, recent_chat: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{question}"),
    ])

    chain = (
        {
            "context": lambda _: context,
            "recent_chat": lambda _: recent_chat,
            "question": RunnablePassthrough(),
        }
        | prompt
        | get_llm()
        | StrOutputParser()
    )
    return chain.invoke(question)


def _generate_answer(
    question: str,
    context: str,
    recent_chat: str,
    images: list[ImageAttachment] | None = None,
) -> tuple[str, str]:
    if images:
        if not _should_use_gemini():
            raise ImageUnderstandingUnavailable(
                "I can work with images when Gemini vision is configured. Right now Scope AI is on the local text fallback, so describe the photo or enable Gemini and I will inspect it directly."
            )
        return _generate_with_gemini(question, context, recent_chat, images=images)

    if _should_use_gemini():
        try:
            return _generate_with_gemini(question, context, recent_chat)
        except Exception:
            if _configured_provider() == "gemini":
                raise
            logger.warning("Gemini generation failed; falling back to Ollama", exc_info=True)

    return _generate_with_ollama(question, context, recent_chat), settings.ollama_model


def _normalize_question(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", value.lower())).strip()


def _is_scope_domain_question(normalized: str) -> bool:
    return bool(
        re.search(
            r"\b(scope|app|screen|button|click|tap|ui|interface|api|endpoint|route path|planner|map|"
            r"trip|travel|route|road trip|itinerary|spot|spots|place|places|experience|experiences|destination|destinations|city|visit|go to|"
            r"stay in|drive|flight|hotel|restaurant|food|budget|pace|timing|schedule|start|"
            r"end|stop|midpoint|address|street|road|avenue|county road|farm to market|photo|"
            r"photos|image|images|review|reviews|friend|friends|notification|notifications|profile|search|weather|safe|safety|group|"
            r"weekend|vacation|ollama|rag|service|frontend|backend)\b",
            normalized,
        )
    )


def _professional_boundary_answer(question: str, has_images: bool = False) -> str | None:
    normalized = _normalize_question(question)
    if not normalized:
        return None

    if re.search(r"\b(i want to (die|kill myself|hurt myself)|suicide|self harm|end my life|hurt myself)\b", normalized):
        return (
            "I am sorry you are dealing with that. If you might hurt yourself or someone else, call emergency services now. "
            "In the U.S. or Canada, call or text 988 for immediate crisis support. If you can, move near another person and tell them you need help right now."
        )

    if re.search(r"\b(fuck you|shut up|you suck|you are useless|you're useless|idiot|moron|dumbass|bitch|asshole)\b", normalized):
        return "I will keep it respectful and useful. Tell me what needs fixing in Scope: the app flow, route, search, notifications, AI answer, or planning behavior."

    if (
        re.search(r"\b(send|show|give).*\b(nudes?|naked|porn|explicit pics?)\b", normalized)
        or re.search(r"\b(are|r)\s+(you|u)\s+(horny|sexy|hot)\b", normalized)
        or re.search(r"\b(date|kiss|marry|sleep with|hook up with)\s+(me|you)\b", normalized)
        or re.search(r"\b(i love you|love you|love u|luv you|be my girlfriend|be my boyfriend)\b", normalized)
    ):
        return "I keep things professional. I cannot be romantic or sexual, but I can help with Scope trips, date-night spots, routes, budgets, timing, and app questions."

    if (
        re.search(
            r"\b(are|r)\s+(you|u)\s+(gay|straight|bi|bisexual|lesbian|trans|transgender|queer|"
            r"asexual|male|female|a man|a woman|a boy|a girl|black|white|asian|latino|"
            r"hispanic|christian|muslim|jewish|religious|liberal|conservative|democrat|"
            r"republican|single|married|dating)\b",
            normalized,
        )
        or re.search(r"\b(what'?s|what is)\s+your\s+(sexuality|sexual orientation|gender|race|ethnicity|religion|politics|political party|age)\b", normalized)
        or re.search(r"\b(do|did)\s+(you|u)\s+(have|got|want)\s+(a\s+)?(girlfriend|boyfriend|partner|wife|husband|kids|children)\b", normalized)
        or re.search(r"\b(who did you vote for|are you into men|are you into women|you gay|u gay)\b", normalized)
    ):
        return (
            "I do not have a sexual orientation, gender, race, religion, politics, or personal relationships. "
            "I am Scope AI, and I will keep it professional: trips, spots, routes, budgets, timing, images, and app help."
        )

    if re.search(r"\b(medical advice|diagnose|prescription|legal advice|lawsuit|eviction|arrested|tax advice|invest|investment|stock|crypto|bet on|gambling)\b", normalized) and not _is_scope_domain_question(normalized):
        return (
            "That is outside what Scope AI should advise on. For medical, legal, tax, investment, or safety-critical decisions, use a qualified professional or current official source. "
            "I can still help with the Scope trip or app context around it."
        )

    if has_images and re.search(r"\b(homework|math|equation|solve this|write code|programming|essay|captcha|diagnose|prescription|lawsuit|stock|crypto|investment)\b", normalized) and not re.search(
        r"\b(scope|trip|route|travel|itinerary|spot|place|destination|pin|budget|pace|photo upload)\b",
        normalized,
    ):
        return (
            "I can inspect images for Scope travel and app help, such as spot photos, route context, tags, accessibility cues, and itinerary fit. "
            "That request is outside Scope, so describe a trip, place, route, or app task and I will help there."
        )

    word_count = len(normalized.split())
    is_question_like = bool(re.search(r"^(what|who|when|why|how|can|could|would|should|do|does|did|is|are|am|will|write|draft|explain|solve|code|make|tell me|teach me|summarize)\b", normalized) or question.strip().endswith("?"))
    if word_count > 3 and is_question_like and not _is_scope_domain_question(normalized):
        return (
            "That is outside Scope trip and app help, so I will keep it professional. "
            "I am best for routes, spots, budgets, timing, photos, search, notifications, and how to use Scope."
        )

    return None


def _vector_search(question: str, filters: dict | None, top_k: int) -> list[dict]:
    try:
        return search(question, k=top_k, filter_dict=filters)
    except Exception:
        logger.warning("Vector search failed; continuing with built-in app knowledge", exc_info=True)
        return []


def _retrieve_context(question: str, filters: dict | None, top_k: int) -> list[dict]:
    app_results = app_catalog.search_app_knowledge(
        question,
        k=min(settings.app_catalog_top_k, top_k),
    )
    vector_results = _vector_search(question, filters, top_k)

    merged: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for result in [*app_results, *vector_results]:
        metadata = result.get("metadata", {})
        key = (
            str(metadata.get("source_type") or metadata.get("source") or ""),
            str(metadata.get("path") or metadata.get("spot_id") or metadata.get("title") or result.get("text", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(result)

    return merged[: max(top_k, len(app_results))]


def _source_title(metadata: dict) -> str:
    return (
        metadata.get("title")
        or metadata.get("spot_name")
        or metadata.get("path")
        or metadata.get("source_type")
        or "Scope source"
    )


def _format_context_item(index: int, result: dict) -> str:
    metadata = result["metadata"]
    source = metadata.get("source")
    source_type = metadata.get("source_type") or source or "scope"

    if source == "app_catalog":
        title = _source_title(metadata)
        method = metadata.get("method")
        path = metadata.get("path")
        service = metadata.get("service")
        header_parts = [f"[{index}] App knowledge: {title}", f"type={source_type}"]
        if method:
            header_parts.append(f"method={method}")
        if path:
            header_parts.append(f"path={path}")
        if service:
            header_parts.append(f"service={service}")
        return " | ".join(header_parts) + f"\n{result['text']}"

    spot_name = metadata.get("spot_name", "Unknown Spot")
    rating = metadata.get("rating", "N/A")
    return f"[{index}] Scope content: Spot={spot_name} | Rating={rating}/5 | type={source_type}\n{result['text']}"

def _normalize_answer(value: str) -> str:
    normalized = re.sub(r"[^\w\s']", " ", value.lower())
    return " ".join(normalized.split())


def _answer_terms(value: str) -> set[str]:
    return {
        token
        for token in _normalize_answer(value).split()
        if len(token) > 3
    }


def _answers_are_too_similar(left: str, right: str) -> bool:
    normalized_left = _normalize_answer(left)
    normalized_right = _normalize_answer(right)
    if not normalized_left or not normalized_right:
        return False

    if normalized_left == normalized_right:
        return True

    left_terms = _answer_terms(normalized_left)
    right_terms = _answer_terms(normalized_right)
    if len(left_terms) < 8 or len(right_terms) < 8:
        return False

    overlap_ratio = len(left_terms & right_terms) / max(len(left_terms), len(right_terms))
    return overlap_ratio >= 0.82


def _format_recent_chat(conversation: list[dict] | None) -> str:
    if not conversation:
        return "No prior chat in this request."

    lines = []
    for turn in conversation[-8:]:
        role = "Scope AI" if turn.get("role") == "assistant" else "User"
        text = str(turn.get("text") or "").strip()
        if not text:
            continue
        lines.append(f"{role}: {' '.join(text.split())[:1000]}")

    return "\n".join(lines) or "No prior chat in this request."


def _recent_assistant_answers(conversation: list[dict] | None) -> list[str]:
    if not conversation:
        return []

    return [
        str(turn.get("text") or "").strip()
        for turn in conversation
        if turn.get("role") == "assistant" and str(turn.get("text") or "").strip()
    ]


def _fresh_repeat_line(question: str, repeat_count: int) -> str:
    clean_question = " ".join(question.split())[:120]
    if clean_question.lower() in {"yo", "hey", "hi", "hello", "sup", "wsp", "scope", "scope ai"}:
        return f"Next move {repeat_count + 1}: give me a route, app page, spot, budget, or timing detail and I will narrow it down."

    if re.search(r"\b(where|how|create|open|find|go|navigate)\b", clean_question.lower()):
        return f"Next move {repeat_count + 1}: I can also point you to the exact Scope page, button, or API route if you name the task."

    return f"Next move {repeat_count + 1}: add a route, place, date, budget, or app-screen detail and I will give a tighter answer."


def _ensure_unique_answer(answer: str, conversation: list[dict] | None, question: str) -> str:
    normalized_answer = _normalize_answer(answer)
    if not normalized_answer:
        return answer

    prior_matches = [
        prior_answer
        for prior_answer in _recent_assistant_answers(conversation)
        if _answers_are_too_similar(prior_answer, normalized_answer)
    ]
    if not prior_matches:
        return answer

    return f"{answer}\n\n{_fresh_repeat_line(question, len(prior_matches))}"


def _extractive_answer(results: list[dict], conversation: list[dict] | None, question: str) -> str:
    """Build a grounded answer if local generation is too slow or unavailable."""
    app_items = []
    content_items = []
    for index, result in enumerate(results[:3], 1):
        metadata = result["metadata"]
        text = result["text"].strip()
        if metadata.get("source") == "app_catalog":
            title = _source_title(metadata)
            path = metadata.get("path")
            method = metadata.get("method")
            label = " ".join(part for part in [method, path] if part) or title
            app_items.append(f"{index}. {label}: {text}")
            continue

        spot_name = metadata.get("spot_name", "Unknown Spot")
        rating = metadata.get("rating", "N/A")
        content_items.append(f"{index}. {spot_name} (rating {rating}/5): {text}")

    items = app_items or content_items
    answer = (
        "Scope found relevant source material, but the AI generator did not finish cleanly. "
        "Based only on the retrieved Scope context, the strongest matches are:\n\n"
        + "\n".join(items)
    )
    return _ensure_unique_answer(answer, conversation, question)


def ask(
    question: str,
    filters: dict | None = None,
    top_k: int | None = None,
    conversation: list[dict] | None = None,
    images: list[ImageAttachment] | None = None,
) -> dict:
    """Ask a question and get a grounded answer."""
    image_list = images or []
    boundary_answer = _professional_boundary_answer(question, has_images=bool(image_list))
    if boundary_answer:
        return {
            "answer": _ensure_unique_answer(boundary_answer, conversation, question),
            "sources": [],
            "model": active_model_name(),
            "context_docs_used": 0,
        }

    k = top_k or settings.retriever_top_k
    results = _retrieve_context(question, filters=filters, top_k=k)

    if not results and not image_list:
        answer = _ensure_unique_answer(
            "I couldn't find any relevant information in Scope to answer that question. Try being more specific about the location or type of experience you're looking for.",
            conversation,
            question,
        )
        return {
            "answer": answer,
            "sources": [],
            "model": active_model_name(),
            "context_docs_used": 0,
        }

    context_parts = []
    for i, result in enumerate(results, 1):
        context_parts.append(_format_context_item(i, result))

    context = "\n\n".join(context_parts) if context_parts else "No retrieved Scope source context. Use the attached image and the user's question, while staying within Scope travel and app help."
    recent_chat = _format_recent_chat(conversation)
    model_name = active_model_name()

    try:
        generated_answer, model_name = _generate_answer(question, context, recent_chat, images=image_list)
        answer = _ensure_unique_answer(generated_answer, conversation, question)
    except ImageUnderstandingUnavailable as exc:
        answer = _ensure_unique_answer(str(exc), conversation, question)
    except Exception:
        logger.warning("RAG generation failed; returning extractive answer", exc_info=True)
        if image_list:
            answer = _ensure_unique_answer(
                "I could not inspect the attached image cleanly on this request. Try a smaller JPEG, PNG, or WebP image, or describe what is visible and I will still help with the Scope trip context.",
                conversation,
                question,
            )
        else:
            answer = _extractive_answer(results, conversation, question)

    return {
        "answer": answer,
        "sources": [
            {
                "source": result["metadata"].get("source"),
                "source_type": result["metadata"].get("source_type") or result["metadata"].get("source"),
                "title": _source_title(result["metadata"]),
                "path": result["metadata"].get("path"),
                "method": result["metadata"].get("method"),
                "service": result["metadata"].get("service"),
                "spot_name": result["metadata"].get("spot_name"),
                "spot_id": result["metadata"].get("spot_id"),
                "rating": result["metadata"].get("rating"),
                "relevance_score": result["score"],
            }
            for result in results
        ],
        "model": model_name,
        "context_docs_used": len(results),
    }
