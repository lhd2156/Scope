"""ChromaDB vector store management."""

from __future__ import annotations

import logging
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

from app.config import settings
from app.embeddings import get_embeddings

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_chroma import Chroma

_vectorstore: Chroma | None = None


def _create_vectorstore() -> Chroma:
    from langchain_chroma import Chroma

    return Chroma(
        collection_name=settings.chroma_collection_name,
        embedding_function=get_embeddings(),
        persist_directory=settings.chroma_persist_dir,
    )


def _is_recoverable_chroma_config_error(error: Exception) -> bool:
    if isinstance(error, KeyError) and error.args == ("_type",):
        return True

    message = str(error)
    return "_type" in message and "configuration" in message.lower()


def _quarantine_persist_dir() -> Path | None:
    persist_dir = Path(settings.chroma_persist_dir)
    if not persist_dir.exists():
        persist_dir.mkdir(parents=True, exist_ok=True)
        return None

    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    target = persist_dir.with_name(f"{persist_dir.name}.incompatible-{timestamp}")
    suffix = 1
    while target.exists():
        target = persist_dir.with_name(f"{persist_dir.name}.incompatible-{timestamp}-{suffix}")
        suffix += 1

    shutil.move(str(persist_dir), str(target))
    persist_dir.mkdir(parents=True, exist_ok=True)
    return target


def _clear_chroma_system_cache() -> None:
    try:
        from chromadb.api.client import SharedSystemClient

        SharedSystemClient.clear_system_cache()
    except Exception:
        logger.debug("Unable to clear ChromaDB shared system cache after quarantine", exc_info=True)


def get_vectorstore() -> Chroma:
    """Get singleton ChromaDB vector store."""
    global _vectorstore
    if _vectorstore is None:
        try:
            _vectorstore = _create_vectorstore()
        except Exception as exc:
            if not _is_recoverable_chroma_config_error(exc):
                raise

            quarantined_path = _quarantine_persist_dir()
            _clear_chroma_system_cache()
            logger.warning(
                "Recovered from incompatible ChromaDB persisted configuration; quarantined_path=%s",
                quarantined_path,
                exc_info=exc,
            )
            _vectorstore = _create_vectorstore()

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
