"""Embedding generation for vector store ingestion and queries."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config import settings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_ollama import OllamaEmbeddings

_embeddings: OllamaEmbeddings | None = None


def get_embeddings() -> OllamaEmbeddings:
    """Get singleton Ollama embedding model (free, local)."""
    global _embeddings
    if _embeddings is None:
        from langchain_ollama import OllamaEmbeddings

        logger.info("Loading Ollama embeddings model=%s", settings.embedding_model)
        _embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )
    return _embeddings


def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text."""
    return get_embeddings().embed_query(text)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    return get_embeddings().embed_documents(texts)
