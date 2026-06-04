"""Lazy-loading model registry. Models are loaded once on first use."""

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"

_registry: dict[str, Any] = {}


def get_model(name: str):
    """Get a loaded model by name. Returns None if not available."""
    return _registry.get(name)


def register_model(name: str, model: Any) -> None:
    """Register a model instance."""
    _registry[name] = model
    logger.info("Registered model: %s", name)


def load_sentiment_model():
    """Load the Hugging Face sentiment model."""
    if "sentiment" in _registry:
        return _registry["sentiment"]

    from transformers import pipeline as hf_pipeline

    from app.ml.device import get_device

    device_idx = 0 if get_device().type == "cuda" else -1
    model = hf_pipeline(
        "sentiment-analysis",
        model="distilbert-base-uncased-finetuned-sst-2-english",
        device=device_idx,
        batch_size=16,
    )
    register_model("sentiment", model)
    return model


def load_tagger_model():
    """Load the image classification model."""
    if "tagger" in _registry:
        return _registry["tagger"]

    from torchvision import models, transforms

    from app.ml.device import get_device

    device = get_device()
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    model.eval()
    model.to(device)

    categories = [
        "beach",
        "mountain",
        "restaurant",
        "cafe",
        "bar",
        "nightlife",
        "museum",
        "park",
        "temple",
        "church",
        "market",
        "shopping",
        "hotel",
        "resort",
        "lake",
        "waterfall",
        "bridge",
        "monument",
        "street",
        "garden",
        "stadium",
        "airport",
        "harbor",
        "forest",
    ]

    transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    register_model("tagger", {"model": model, "transform": transform, "categories": categories, "device": device})
    return _registry["tagger"]


def load_ncf_model():
    """Load the Neural Collaborative Filtering model + FAISS index."""
    if "ncf" in _registry:
        return _registry["ncf"]

    import torch

    from app.ml.device import get_device

    model_path = MODELS_DIR / "ncf_model.pt"
    index_path = MODELS_DIR / "faiss_index.bin"

    if not model_path.exists():
        logger.warning("NCF model not found at %s - recommendations will use fallback", model_path)
        return None

    device = get_device()

    from app.ml.inference.recommender import NCFModel

    checkpoint = torch.load(model_path, map_location=device, weights_only=True)
    model = NCFModel(
        num_users=checkpoint["num_users"],
        num_items=checkpoint["num_items"],
        embedding_dim=checkpoint.get("embedding_dim", 64),
    )
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    model.to(device)

    faiss_index = None
    if index_path.exists():
        import faiss

        faiss_index = faiss.read_index(str(index_path))
        logger.info("Loaded FAISS index with %d vectors", faiss_index.ntotal)

    register_model("ncf", {"model": model, "faiss_index": faiss_index, "device": device})
    return _registry["ncf"]
