"""Retriever helpers for Scope RAG queries."""

from app.config import settings
from app.vectorstore import search


def retrieve(query: str, filters: dict | None = None, top_k: int | None = None) -> list[dict]:
    """Retrieve the most relevant documents for a query."""
    k = top_k or settings.retriever_top_k
    return search(query, k=k, filter_dict=filters)
