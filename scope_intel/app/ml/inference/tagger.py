"""Image classification / auto-tagging using EfficientNet."""

import io
import logging
from typing import Any

import torch
from PIL import Image

logger = logging.getLogger(__name__)


def classify_image(image_bytes: bytes, top_k: int = 5) -> list[dict[str, Any]]:
    """Classify an image and return top-k predicted tags.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG).
        top_k: Number of top predictions to return.

    Returns: [{"tag": "beach", "confidence": 0.92}, ...]
    """
    from app.ml.registry import load_tagger_model

    tagger = load_tagger_model()
    model = tagger["model"]
    transform = tagger["transform"]
    categories = tagger["categories"]
    device = tagger["device"]

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)

    top_probs, top_indices = torch.topk(probabilities, min(top_k * 10, len(probabilities)))

    results = []
    for prob, idx in zip(top_probs, top_indices):
        cat_idx = idx.item() % len(categories)
        tag = categories[cat_idx]
        if not any(r["tag"] == tag for r in results):
            results.append({"tag": tag, "confidence": round(prob.item(), 4)})
        if len(results) >= top_k:
            break

    return results


def classify_from_url(url: str, top_k: int = 5) -> list[dict[str, Any]]:
    """Download image from URL and classify."""
    import requests

    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return classify_image(response.content, top_k)
