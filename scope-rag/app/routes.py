"""RAG API routes."""

import base64
import binascii
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app import app_catalog, chain, vectorstore
from app.config import settings

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


class IngestRequest(BaseModel):
    id: str
    text: str
    metadata: dict


@router.post("/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    """Ask a natural-language question about Scope spots and experiences."""
    try:
        conversation = [turn.model_dump() for turn in req.conversation]
        images = [image.model_dump() for image in req.images]
        return chain.ask(req.question, filters=req.filters, top_k=req.top_k, conversation=conversation, images=images)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/ingest")
async def ingest_document(req: IngestRequest):
    """Ingest a single document into the vector store."""
    vectorstore.add_document(req.id, req.text, req.metadata)
    return {"status": "ingested", "id": req.id}


@router.get("/search")
async def search_vectors(q: str, k: int = 10, include_app_catalog: bool = True):
    """Search app knowledge and the vector store directly (for debugging)."""
    results = app_catalog.search_app_knowledge(q, k=k) if include_app_catalog else []
    try:
        results.extend(vectorstore.search(q, k=k))
    except Exception as exc:
        if not results:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"query": q, "results": results[:k]}


@router.get("/app-knowledge")
async def app_knowledge():
    """Return built-in app knowledge docs available without vector seeding."""
    docs = app_catalog.get_app_knowledge_documents()
    return {
        "count": len(docs),
        "catalog_version": app_catalog.CATALOG_VERSION,
        "documents": [
            {
                "id": doc["id"],
                "metadata": doc["metadata"],
                "text": doc["text"],
            }
            for doc in docs
        ],
    }


@router.get("/health")
async def health():
    """Health check."""
    return {
        "status": "healthy",
        "service": "scope-rag",
        "vector_count": vectorstore.get_vector_count(),
        "app_catalog_count": app_catalog.get_app_knowledge_count(),
        "model": chain.active_model_name(),
        "chat_provider": "gemini" if chain.active_model_name() == settings.gemini_model and settings.gemini_api_key else "ollama",
        "chat_model": chain.active_model_name(),
        "local_provider": "ollama",
        "local_fallback_model": settings.ollama_model,
        "embedding_model": settings.embedding_model,
        "embedding_provider": "ollama",
        "vision_enabled": chain.active_model_name() == settings.gemini_model and bool(settings.gemini_api_key),
        "vision_model": settings.gemini_model,
    }
