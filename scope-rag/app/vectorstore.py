"""ChromaDB vector store management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.config import settings
from app.embeddings import get_embeddings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_chroma import Chroma

_vectorstore: Chroma | None = None


def get_vectorstore() -> Chroma:
    """Get singleton ChromaDB vector store."""
    global _vectorstore
    if _vectorstore is None:
        from langchain_chroma import Chroma

        _vectorstore = Chroma(
            collection_name=settings.chroma_collection_name,
            embedding_function=get_embeddings(),
            persist_directory=settings.chroma_persist_dir,
        )
        logger.info(
            "ChromaDB initialized: collection=%s, persist_dir=%s",
            settings.chroma_collection_name,
            settings.chroma_persist_dir,
        )
    return _vectorstore


def add_document(doc_id: str, text: str, metadata: dict[str, Any]) -> None:
    """Add a single document to the vector store."""
    store = get_vectorstore()
    store.add_texts(texts=[text], metadatas=[metadata], ids=[doc_id])


def add_documents(docs: list[dict[str, Any]]) -> None:
    """Add multiple documents to the vector store.

    Each doc: {"id": str, "text": str, "metadata": dict}
    """
    store = get_vectorstore()
    store.add_texts(
        texts=[d["text"] for d in docs],
        metadatas=[d["metadata"] for d in docs],
        ids=[d["id"] for d in docs],
    )


def get_vector_count() -> int:
    """Return the current persisted vector count."""
    store = get_vectorstore()
    return int(store._collection.count())


def search(query: str, k: int = 10, filter_dict: dict | None = None) -> list[dict]:
    """Search the vector store for similar documents."""
    store = get_vectorstore()
    results = store.similarity_search_with_score(query, k=k, filter=filter_dict)
    return [
        {
            "text": doc.page_content,
            "metadata": doc.metadata,
            "score": float(score),
        }
        for doc, score in results
    ]
