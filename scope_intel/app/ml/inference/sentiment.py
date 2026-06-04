"""Sentiment analysis inference using Hugging Face DistilBERT."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def analyze_sentiment(text: str) -> dict[str, Any]:
    """Analyze sentiment of a single text.

    Returns: {"label": "POSITIVE"|"NEGATIVE", "score": 0.0-1.0, "normalized_score": -1.0 to 1.0}
    """
    from app.ml.registry import load_sentiment_model

    try:
        model = load_sentiment_model()
    except ImportError:
        logger.warning("Transformers not installed; using heuristic sentiment fallback")
        return _heuristic_sentiment(text)

    result = model(text, truncation=True, max_length=512)[0]

    label = result["label"]
    score = result["score"]

    normalized = score if label == "POSITIVE" else -score

    return {
        "label": label,
        "score": round(score, 4),
        "normalized_score": round(normalized, 4),
    }


def analyze_batch(texts: list[str]) -> list[dict[str, Any]]:
    """Analyze sentiment for a batch of texts."""
    from app.ml.registry import load_sentiment_model

    try:
        model = load_sentiment_model()
    except ImportError:
        logger.warning("Transformers not installed; using heuristic batch sentiment fallback")
        return [_heuristic_sentiment(text) for text in texts]

    results = model(texts, truncation=True, max_length=512)

    output = []
    for result in results:
        label = result["label"]
        score = result["score"]
        normalized = score if label == "POSITIVE" else -score
        output.append(
            {
                "label": label,
                "score": round(score, 4),
                "normalized_score": round(normalized, 4),
            }
        )

    return output


def _heuristic_sentiment(text: str) -> dict[str, Any]:
    positive_words = {
        "amazing",
        "best",
        "beautiful",
        "clean",
        "excellent",
        "favorite",
        "great",
        "love",
        "loved",
        "perfect",
        "wonderful",
    }
    negative_words = {
        "awful",
        "bad",
        "dirty",
        "hate",
        "hated",
        "never",
        "poor",
        "rude",
        "terrible",
        "worst",
    }
    normalized = text.lower()
    positive_hits = sum(1 for word in positive_words if word in normalized)
    negative_hits = sum(1 for word in negative_words if word in normalized)
    if positive_hits >= negative_hits:
        score = min(0.98, 0.82 + (positive_hits * 0.04))
        return {"label": "POSITIVE", "score": round(score, 4), "normalized_score": round(score, 4)}

    score = min(0.98, 0.82 + (negative_hits * 0.04))
    return {"label": "NEGATIVE", "score": round(score, 4), "normalized_score": round(-score, 4)}
