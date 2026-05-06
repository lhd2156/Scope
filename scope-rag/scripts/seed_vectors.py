"""Bulk-ingest existing Scope spots and reviews into the vector store."""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.vectorstore import add_documents

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


def _spot_doc(spot: dict) -> dict:
    text = " ".join(
        part
        for part in [
            spot.get("title") or "",
            spot.get("description") or "",
            spot.get("category") or "",
            spot.get("vibe") or "",
            spot.get("city") or "",
            spot.get("country") or "",
        ]
        if part
    )
    return {
        "id": f"spot:{spot['id']}",
        "text": text,
        "metadata": {
            "spot_id": str(spot["id"]),
            "spot_name": spot.get("title") or "Unknown Spot",
            "rating": spot.get("rating") or spot.get("average_rating"),
            "category": spot.get("category"),
            "city": spot.get("city"),
            "country": spot.get("country"),
            "source": "spot",
        },
    }


def _review_doc(review: dict, spot: dict) -> dict | None:
    comment = review.get("comment") or ""
    if not comment.strip():
        return None
    return {
        "id": f"review:{review['id']}",
        "text": comment,
        "metadata": {
            "review_id": str(review["id"]),
            "spot_id": str(spot["id"]),
            "spot_name": spot.get("title") or "Unknown Spot",
            "rating": review.get("rating"),
            "category": spot.get("category"),
            "city": spot.get("city"),
            "country": spot.get("country"),
            "source": "review",
        },
    }


def seed() -> int:
    docs: list[dict] = []

    with httpx.Client(timeout=15) as client:
        spots_response = client.get(f"{settings.content_service_url}/spots/")
        spots_response.raise_for_status()
        spots_payload = spots_response.json()
        spots = spots_payload.get("results") or spots_payload.get("data") or []

        for spot in spots:
            docs.append(_spot_doc(spot))

            reviews_response = client.get(f"{settings.content_service_url}/reviews/spot/{spot['id']}")
            if not reviews_response.is_success:
                continue
            reviews = reviews_response.json().get("data") or []
            for review in reviews:
                doc = _review_doc(review, spot)
                if doc is not None:
                    docs.append(doc)

    if docs:
        add_documents(docs)
    logger.info("Seeded %d vector documents", len(docs))
    return len(docs)


if __name__ == "__main__":
    seed()
