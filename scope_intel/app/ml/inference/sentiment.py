"""Sentiment analysis inference using Hugging Face DistilBERT."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def analyze_sentiment(text: str) -> dict[str, Any]:
    """Analyze sentiment of a single text.

    Returns: {"label": "POSITIVE"|"NEGATIVE", "score": 0.0-1.0, "normalized_score": -1.0 to 1.0}
    """
    from app.ml.registry import load_sentiment_model

    model = load_sentiment_model()
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

    model = load_sentiment_model()
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
