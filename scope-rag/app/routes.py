"""RAG API routes."""

import base64
import binascii
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app import app_catalog, chain, vectorstore
from app.config import settings
from app.security import require_auth, require_ingest_admin

router = APIRouter(prefix="/api/rag")
SUPPORTED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(..., min_length=1, max_length=1000)


class ImageAttachment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    filename: str | None = Field(default=None, max_length=160)
    mime_type: str = Field(..., validation_alias=AliasChoices("mime_type", "mimeType"))
    data: str = Field(..., min_length=4)

    @field_validator("mime_type")
    @classmethod
    def validate_mime_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in SUPPORTED_IMAGE_MIME_TYPES:
            raise ValueError("Only JPEG, PNG, and WebP images are supported")
        return normalized

    @field_validator("data")
    @classmethod
    def validate_base64_data(cls, value: str) -> str:
        compact = "".join(value.split())
        try:
            decoded = base64.b64decode(compact, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Image data must be valid base64") from exc

        if len(decoded) > MAX_INLINE_IMAGE_BYTES:
            raise ValueError("Images must be 4 MB or smaller")

        return compact


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    filters: dict | None = None
    top_k: int = Field(default=10, ge=1, le=50)
    conversation: list[ConversationTurn] = Field(default_factory=list, max_length=8)
    images: list[ImageAttachment] = Field(default_factory=list, max_length=3)


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
    model: str
    context_docs_used: int


class ScopeAiChatRequest(BaseModel):
    system_prompt: str = Field(..., min_length=10)
    planner_state: dict = Field(default_factory=dict)
    session_history: list[dict] = Field(default_factory=list, max_length=20)
    preferences: dict = Field(default_factory=dict)
    message: str = Field(..., min_length=1, max_length=2000)
    images: list[ImageAttachment] = Field(default_factory=list, max_length=3)


class ScopeAiChatResponse(BaseModel):
    response: str
    model: str


class IngestRequest(BaseModel):
    id: str
    text: str
    metadata: dict


def _dump_images(images: list[ImageAttachment]) -> list[dict]:
    return [image.model_dump() for image in images]


def _dump_conversation(turns: list[ConversationTurn]) -> list[dict]:
    return [turn.model_dump() for turn in turns]


def _serialize_app_knowledge_doc(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "metadata": doc["metadata"],
        "text": doc["text"],
    }


def _active_chat_provider(model_name: str) -> str:
    return "gemini" if model_name == settings.gemini_model and settings.gemini_api_key else "ollama"


def _health_payload() -> dict:
    active_model = chain.active_model_name()
    vision_enabled = active_model == settings.gemini_model and bool(settings.gemini_api_key)
    return {
        "status": "healthy",
        "service": "scope-rag",
        "vector_count": vectorstore.get_vector_count(),
        "app_catalog_count": app_catalog.get_app_knowledge_count(),
        "model": active_model,
        "chat_provider": _active_chat_provider(active_model),
        "chat_model": active_model,
        "local_provider": "ollama",
        "local_fallback_model": settings.ollama_model,
        "embedding_model": settings.embedding_model,
        "embedding_provider": "ollama",
        "vision_enabled": vision_enabled,
        "vision_model": settings.gemini_model,
    }


@router.post("/ask", response_model=AskResponse, dependencies=[Depends(require_auth)])
async def ask_question(req: AskRequest):
    """Ask a natural-language question about Scope spots and experiences."""
    try:
        return chain.ask(
            req.question,
            filters=req.filters,
            top_k=req.top_k,
            conversation=_dump_conversation(req.conversation),
            images=_dump_images(req.images),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/scope-ai", response_model=ScopeAiChatResponse, dependencies=[Depends(require_auth)])
async def scope_ai_chat(req: ScopeAiChatRequest):
    """Scope AI route copilot chat endpoint. Uses custom system prompt with Gemini/Ollama."""
    try:
        result = chain.scope_ai_chat(
            system_prompt=req.system_prompt,
            planner_state=req.planner_state,
            session_history=req.session_history,
            preferences=req.preferences,
            message=req.message,
            images=_dump_images(req.images),
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scope AI generation failed: {exc}") from exc


@router.post("/ingest", dependencies=[Depends(require_ingest_admin)])
async def ingest_document(req: IngestRequest):
    """Ingest a single document into the vector store."""
    vectorstore.add_document(req.id, req.text, req.metadata)
    return {"status": "ingested", "id": req.id}


@router.get("/search", dependencies=[Depends(require_auth)])
async def search_vectors(q: str, k: int = Query(default=10, ge=1, le=50), include_app_catalog: bool = True):
    """Search app knowledge and the vector store directly (for debugging)."""
    results = app_catalog.search_app_knowledge(q, k=k) if include_app_catalog else []
    try:
        results.extend(vectorstore.search(q, k=k))
    except Exception as exc:
        if not results:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"query": q, "results": results[:k]}


@router.get("/app-knowledge", dependencies=[Depends(require_auth)])
async def app_knowledge():
    """Return built-in app knowledge docs available without vector seeding."""
    docs = app_catalog.get_app_knowledge_documents()
    return {
        "count": len(docs),
        "catalog_version": app_catalog.CATALOG_VERSION,
        "documents": [_serialize_app_knowledge_doc(doc) for doc in docs],
    }


@router.get("/health")
async def health():
    """Health check."""
    return _health_payload()
