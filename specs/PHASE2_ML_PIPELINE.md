# Phase 2: ML Pipeline — Codex Build Spec

> **Scope**: Add PyTorch ML models, Hugging Face NLP, FAISS vector search, and CUDA GPU support to the Intel API.
> **Prerequisites**: Phase 1 complete (Elasticsearch + RabbitMQ running). Existing Intel API at `scope_intel/`.
> **Do NOT modify**: Core API, Frontend, iOS, Android, Metrics, CLI, scope_media, scope_geo.

---

## Overview

The Intel API (`scope_intel/`) currently uses scikit-learn for TF-IDF recommendations. This phase adds:

1. **Sentiment analysis** — Hugging Face DistilBERT for review sentiment scoring
2. **Image classification** — PyTorch EfficientNet for auto-tagging uploaded photos
3. **Collaborative filtering** — PyTorch NCF + FAISS for "users who liked X also liked Y"
4. **Trip prediction** — XGBoost for trip duration/cost estimation
5. **CUDA Docker variant** — GPU-accelerated inference container

---

## 1. New Dependencies

**File**: `scope_intel/requirements.txt` (MODIFY — append)

```
# ── ML Pipeline (Phase 2) ─────────────────────────
torch>=2.6.0
torchvision>=0.21.0
transformers>=4.50.0
tokenizers>=0.21.0
faiss-cpu>=1.11.0
xgboost>=3.0.0
pandas>=2.2.0
Pillow>=12.0.0
```

---

## 2. Directory Structure

Create the following under `scope_intel/`:

```
scope_intel/
├── app/
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── device.py              # CUDA/CPU device detection
│   │   ├── registry.py            # Model registry (lazy loading)
│   │   ├── models/                # Saved model artifacts (gitignored)
│   │   │   └── .gitkeep
│   │   ├── training/
│   │   │   ├── __init__.py
│   │   │   ├── train_sentiment.py
│   │   │   ├── train_tagger.py
│   │   │   ├── train_ncf.py
│   │   │   └── train_trip.py
│   │   └── inference/
│   │       ├── __init__.py
│   │       ├── sentiment.py
│   │       ├── tagger.py
│   │       ├── recommender.py
│   │       └── predictor.py
│   ├── routes/
│   │   ├── sentiment.py           # NEW
│   │   ├── classify.py            # NEW
│   │   ├── predict.py             # NEW
│   │   └── recommendations.py     # MODIFY (add NCF endpoint)
```

---

## 3. Device Detection

**File**: `scope_intel/app/ml/device.py` (NEW)

```python
"""CUDA / CPU device detection for PyTorch inference."""

import logging
import torch

logger = logging.getLogger(__name__)

_device = None


def get_device() -> torch.device:
    """Return the best available device. Caches result."""
    global _device
    if _device is not None:
        return _device

    if torch.cuda.is_available():
        _device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_mem / (1024 ** 3)
        logger.info("Using CUDA device: %s (%.1f GB VRAM)", gpu_name, vram)
    else:
        _device = torch.device("cpu")
        logger.info("CUDA not available — using CPU")

    return _device


def device_info() -> dict:
    """Return device information for health/debug endpoints."""
    dev = get_device()
    info = {
        "device": str(dev),
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__,
    }
    if torch.cuda.is_available():
        info["gpu_name"] = torch.cuda.get_device_name(0)
        info["gpu_memory_gb"] = round(torch.cuda.get_device_properties(0).total_mem / (1024 ** 3), 1)
        info["cuda_version"] = torch.version.cuda
    return info
```

---

## 4. Model Registry

**File**: `scope_intel/app/ml/registry.py` (NEW)

```python
"""Lazy-loading model registry. Models are loaded once on first use."""

import logging
import os
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

    import torch
    from torchvision import models, transforms
    from app.ml.device import get_device

    device = get_device()
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    model.eval()
    model.to(device)

    # Define travel/place category labels
    categories = [
        "beach", "mountain", "restaurant", "cafe", "bar", "nightlife",
        "museum", "park", "temple", "church", "market", "shopping",
        "hotel", "resort", "lake", "waterfall", "bridge", "monument",
        "street", "garden", "stadium", "airport", "harbor", "forest",
    ]

    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

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
        logger.warning("NCF model not found at %s — recommendations will use fallback", model_path)
        return None

    device = get_device()

    # Load the trained NCF model
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

    # Load FAISS index if available
    faiss_index = None
    if index_path.exists():
        import faiss
        faiss_index = faiss.read_index(str(index_path))
        logger.info("Loaded FAISS index with %d vectors", faiss_index.ntotal)

    register_model("ncf", {"model": model, "faiss_index": faiss_index, "device": device})
    return _registry["ncf"]
```

---

## 5. Inference Modules

### 5a. Sentiment Analysis

**File**: `scope_intel/app/ml/inference/sentiment.py` (NEW)

```python
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

    # Normalize to -1.0 (very negative) to 1.0 (very positive)
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
        output.append({
            "label": label,
            "score": round(score, 4),
            "normalized_score": round(normalized, 4),
        })

    return output
```

### 5b. Image Classification

**File**: `scope_intel/app/ml/inference/tagger.py` (NEW)

```python
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

    # Load and transform image
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    # Inference
    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)

    # Map ImageNet classes to travel categories using top predictions
    top_probs, top_indices = torch.topk(probabilities, min(top_k * 10, len(probabilities)))

    # For now, use a heuristic mapping from ImageNet → travel categories
    # In production, you'd fine-tune the classifier head on travel-specific data
    results = []
    for prob, idx in zip(top_probs, top_indices):
        # Map to closest travel category (simplified — replace with fine-tuned head)
        cat_idx = idx.item() % len(categories)
        tag = categories[cat_idx]
        # Deduplicate
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
```

### 5c. Neural Collaborative Filtering

**File**: `scope_intel/app/ml/inference/recommender.py` (NEW)

```python
"""Neural Collaborative Filtering for spot recommendations."""

import logging
from typing import Any

import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class NCFModel(nn.Module):
    """Neural Collaborative Filtering model.

    Combines Generalized Matrix Factorization (GMF) with a Multi-Layer
    Perceptron (MLP) for learning user-item interaction patterns.
    """

    def __init__(self, num_users: int, num_items: int, embedding_dim: int = 64):
        super().__init__()
        self.num_users = num_users
        self.num_items = num_items
        self.embedding_dim = embedding_dim

        # GMF path
        self.user_embedding_gmf = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_gmf = nn.Embedding(num_items, embedding_dim)

        # MLP path
        self.user_embedding_mlp = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_mlp = nn.Embedding(num_items, embedding_dim)
        self.mlp = nn.Sequential(
            nn.Linear(embedding_dim * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
        )

        # Prediction layer
        self.predict = nn.Linear(embedding_dim + 32, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, user_ids: torch.Tensor, item_ids: torch.Tensor) -> torch.Tensor:
        # GMF
        gmf_user = self.user_embedding_gmf(user_ids)
        gmf_item = self.item_embedding_gmf(item_ids)
        gmf_out = gmf_user * gmf_item

        # MLP
        mlp_user = self.user_embedding_mlp(user_ids)
        mlp_item = self.item_embedding_mlp(item_ids)
        mlp_input = torch.cat([mlp_user, mlp_item], dim=-1)
        mlp_out = self.mlp(mlp_input)

        # Combine
        combined = torch.cat([gmf_out, mlp_out], dim=-1)
        return self.sigmoid(self.predict(combined)).squeeze(-1)

    def get_user_embedding(self, user_id: int) -> torch.Tensor:
        """Get combined user embedding for FAISS indexing."""
        with torch.no_grad():
            uid = torch.tensor([user_id], device=next(self.parameters()).device)
            gmf = self.user_embedding_gmf(uid)
            mlp = self.user_embedding_mlp(uid)
            return torch.cat([gmf, mlp], dim=-1).cpu().numpy().flatten()


def recommend_spots(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Get spot recommendations for a user using NCF + FAISS.

    Falls back to popularity-based recommendations if NCF model is not loaded.
    """
    from app.ml.registry import load_ncf_model

    ncf = load_ncf_model()
    if ncf is None:
        return _fallback_recommendations(limit)

    model = ncf["model"]
    faiss_index = ncf["faiss_index"]
    device = ncf["device"]

    if faiss_index is None:
        return _fallback_recommendations(limit)

    try:
        import numpy as np

        # Get user embedding
        user_idx = _resolve_user_index(user_id)
        if user_idx is None:
            return _fallback_recommendations(limit)

        user_emb = model.get_user_embedding(user_idx)
        user_emb = np.array([user_emb], dtype=np.float32)

        # Search FAISS index for nearest items
        distances, indices = faiss_index.search(user_emb, limit)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0:
                continue
            spot_id = _resolve_spot_id(int(idx))
            results.append({
                "spot_id": spot_id,
                "score": round(1.0 / (1.0 + float(dist)), 4),
                "source": "ncf",
            })

        return results

    except Exception:
        logger.exception("NCF recommendation failed, using fallback")
        return _fallback_recommendations(limit)


def _fallback_recommendations(limit: int) -> list[dict[str, Any]]:
    """Popularity-based fallback when NCF is unavailable."""
    # Fetch top spots by review count from Content API
    import os
    import requests

    content_url = os.environ.get("CONTENT_SERVICE_URL", "http://content:8000/api/content")
    try:
        resp = requests.get(f"{content_url}/spots/?ordering=-review_count&limit={limit}", timeout=10)
        if resp.ok:
            spots = resp.json().get("results", [])
            return [{"spot_id": s["id"], "score": 1.0, "source": "popularity"} for s in spots[:limit]]
    except Exception:
        pass
    return []


def _resolve_user_index(user_id: str) -> int | None:
    """Map external user ID to model's internal user index."""
    # This mapping is created during training and stored alongside the model.
    # For now, return a simple hash-based index. Replace with actual mapping.
    try:
        return abs(hash(user_id)) % 10000
    except Exception:
        return None


def _resolve_spot_id(index: int) -> str:
    """Map model's internal item index back to external spot ID."""
    # Same as above — replace with actual mapping from training.
    return f"spot-{index}"
```

### 5d. Trip Predictor

**File**: `scope_intel/app/ml/inference/predictor.py` (NEW)

```python
"""Trip duration and cost prediction using XGBoost."""

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parents[1] / "models"


def predict_trip(features: dict[str, Any]) -> dict[str, Any]:
    """Predict trip duration (days) and estimated cost.

    Args:
        features: {
            "num_spots": int,
            "total_distance_km": float,
            "avg_rating": float,
            "num_outdoor": int,
            "num_food": int,
            "num_cultural": int,
            "month": int,  # 1-12
        }

    Returns: {"predicted_days": float, "predicted_cost_usd": float, "confidence": float}
    """
    try:
        import xgboost as xgb
    except ImportError:
        logger.warning("XGBoost not installed")
        return _heuristic_prediction(features)

    duration_model_path = MODELS_DIR / "trip_duration.json"
    cost_model_path = MODELS_DIR / "trip_cost.json"

    if not duration_model_path.exists() or not cost_model_path.exists():
        logger.info("Trip prediction models not found, using heuristic")
        return _heuristic_prediction(features)

    # Load models
    duration_model = xgb.Booster()
    duration_model.load_model(str(duration_model_path))
    cost_model = xgb.Booster()
    cost_model.load_model(str(cost_model_path))

    # Build feature vector
    feature_names = ["num_spots", "total_distance_km", "avg_rating", "num_outdoor", "num_food", "num_cultural", "month"]
    x = np.array([[features.get(f, 0) for f in feature_names]], dtype=np.float32)
    dmatrix = xgb.DMatrix(x, feature_names=feature_names)

    # Predict
    predicted_days = float(duration_model.predict(dmatrix)[0])
    predicted_cost = float(cost_model.predict(dmatrix)[0])

    return {
        "predicted_days": round(max(predicted_days, 0.5), 1),
        "predicted_cost_usd": round(max(predicted_cost, 0), 2),
        "confidence": 0.75,
        "source": "xgboost",
    }


def _heuristic_prediction(features: dict[str, Any]) -> dict[str, Any]:
    """Simple heuristic when models are not available."""
    num_spots = features.get("num_spots", 1)
    distance = features.get("total_distance_km", 0)

    days = max(1, num_spots * 0.5 + distance / 200)
    cost = days * 150 + num_spots * 25

    return {
        "predicted_days": round(days, 1),
        "predicted_cost_usd": round(cost, 2),
        "confidence": 0.3,
        "source": "heuristic",
    }
```

---

## 6. API Routes

### 6a. Sentiment Route

**File**: `scope_intel/app/routes/sentiment.py` (NEW)

```python
"""Sentiment analysis API routes."""

from flask import Blueprint, jsonify, request

from app.ml.inference.sentiment import analyze_sentiment, analyze_batch

bp = Blueprint("sentiment", __name__, url_prefix="/api/intel/sentiment")


@bp.route("", methods=["POST"])
def sentiment():
    """Analyze sentiment of text.

    Body: {"text": "Great place!"} or {"texts": ["Great!", "Terrible."]}
    """
    data = request.get_json(silent=True) or {}

    # Single text
    if "text" in data:
        result = analyze_sentiment(data["text"])
        result["review_id"] = data.get("review_id")
        return jsonify(result)

    # Batch
    if "texts" in data:
        results = analyze_batch(data["texts"])
        return jsonify({"results": results})

    return jsonify({"error": "Provide 'text' or 'texts' in request body"}), 400
```

### 6b. Image Classification Route

**File**: `scope_intel/app/routes/classify.py` (NEW)

```python
"""Image classification API routes."""

import base64

from flask import Blueprint, jsonify, request

from app.ml.inference.tagger import classify_image, classify_from_url

bp = Blueprint("classify", __name__, url_prefix="/api/intel")


@bp.route("/classify-image", methods=["POST"])
def classify():
    """Classify an image and return auto-tags.

    Body: {"url": "https://..."} or {"image_base64": "..."} or multipart file upload.
    Optional: {"top_k": 5}
    """
    top_k = 5
    data = request.get_json(silent=True) or {}

    if data.get("top_k"):
        top_k = min(int(data["top_k"]), 20)

    # URL-based
    if "url" in data:
        tags = classify_from_url(data["url"], top_k)
        return jsonify({"tags": tags, "photo_id": data.get("photo_id")})

    # Base64-based
    if "image_base64" in data:
        image_bytes = base64.b64decode(data["image_base64"])
        tags = classify_image(image_bytes, top_k)
        return jsonify({"tags": tags, "photo_id": data.get("photo_id")})

    # File upload
    if "image" in request.files:
        image_bytes = request.files["image"].read()
        tags = classify_image(image_bytes, top_k)
        return jsonify({"tags": tags})

    return jsonify({"error": "Provide 'url', 'image_base64', or file upload"}), 400
```

### 6c. Trip Prediction Route

**File**: `scope_intel/app/routes/predict.py` (NEW)

```python
"""Trip prediction API routes."""

from flask import Blueprint, jsonify, request

from app.ml.inference.predictor import predict_trip

bp = Blueprint("predict", __name__, url_prefix="/api/intel")


@bp.route("/predict-trip", methods=["POST"])
def predict():
    """Predict trip duration and cost.

    Body: {"num_spots": 5, "total_distance_km": 120, "avg_rating": 4.2, ...}
    """
    data = request.get_json(silent=True) or {}

    required = ["num_spots"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    result = predict_trip(data)
    return jsonify(result)
```

### 6d. ML Info/Health Route

**File**: `scope_intel/app/routes/ml_health.py` (NEW)

```python
"""ML system health and info routes."""

from flask import Blueprint, jsonify

from app.ml.device import device_info
from app.ml.registry import _registry

bp = Blueprint("ml_health", __name__, url_prefix="/api/intel/ml")


@bp.route("/info", methods=["GET"])
def info():
    """Return ML system info: device, loaded models, versions."""
    return jsonify({
        "device": device_info(),
        "loaded_models": list(_registry.keys()),
        "model_count": len(_registry),
    })
```

### 6e. Register routes in Flask app

**File**: `scope_intel/app/__init__.py` or wherever the Flask app factory is (MODIFY)

Find the `create_app()` function and register the new blueprints:

```python
from app.routes.sentiment import bp as sentiment_bp
from app.routes.classify import bp as classify_bp
from app.routes.predict import bp as predict_bp
from app.routes.ml_health import bp as ml_health_bp

app.register_blueprint(sentiment_bp)
app.register_blueprint(classify_bp)
app.register_blueprint(predict_bp)
app.register_blueprint(ml_health_bp)
```

---

## 7. Training Scripts

### 7a. Sentiment Training

**File**: `scope_intel/app/ml/training/train_sentiment.py` (NEW)

```python
"""Fine-tune DistilBERT for review sentiment on Scope data.

Usage:
    python -m app.ml.training.train_sentiment --data reviews.csv --output app/ml/models/sentiment
"""

import argparse
import logging

import pandas as pd
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)
from datasets import Dataset

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with 'text' and 'label' columns")
    parser.add_argument("--output", default="app/ml/models/sentiment")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    assert "text" in df.columns and "label" in df.columns

    model_name = "distilbert-base-uncased-finetuned-sst-2-english"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

    dataset = Dataset.from_pandas(df)
    dataset = dataset.map(lambda x: tokenizer(x["text"], truncation=True, padding="max_length", max_length=128), batched=True)
    dataset = dataset.train_test_split(test_size=0.2)

    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        logging_steps=50,
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=dataset["train"], eval_dataset=dataset["test"])
    trainer.train()
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    logger.info("Saved fine-tuned model to %s", args.output)


if __name__ == "__main__":
    main()
```

### 7b. NCF Training

**File**: `scope_intel/app/ml/training/train_ncf.py` (NEW)

```python
"""Train Neural Collaborative Filtering model on user-spot interactions.

Usage:
    python -m app.ml.training.train_ncf --data interactions.csv --output app/ml/models/
"""

import argparse
import logging

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with 'user_id', 'item_id', 'rating' columns")
    parser.add_argument("--output", default="app/ml/models/")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--embedding-dim", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    from app.ml.inference.recommender import NCFModel

    df = pd.read_csv(args.data)
    user_ids = df["user_id"].astype("category").cat.codes.values
    item_ids = df["item_id"].astype("category").cat.codes.values
    ratings = df["rating"].values.astype(np.float32)
    ratings = (ratings - ratings.min()) / (ratings.max() - ratings.min())  # Normalize to [0, 1]

    num_users = int(user_ids.max()) + 1
    num_items = int(item_ids.max()) + 1

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = NCFModel(num_users, num_items, args.embedding_dim).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.BCELoss()

    dataset = TensorDataset(torch.LongTensor(user_ids), torch.LongTensor(item_ids), torch.FloatTensor(ratings))
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0
        for batch_users, batch_items, batch_ratings in loader:
            batch_users = batch_users.to(device)
            batch_items = batch_items.to(device)
            batch_ratings = batch_ratings.to(device)

            preds = model(batch_users, batch_items)
            loss = criterion(preds, batch_ratings)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        logger.info("Epoch %d/%d — Loss: %.4f", epoch + 1, args.epochs, avg_loss)

    # Save model
    output_path = f"{args.output}/ncf_model.pt"
    torch.save({
        "state_dict": model.state_dict(),
        "num_users": num_users,
        "num_items": num_items,
        "embedding_dim": args.embedding_dim,
    }, output_path)
    logger.info("Saved NCF model to %s", output_path)

    # Build FAISS index from item embeddings
    try:
        import faiss

        model.eval()
        item_embeddings = []
        with torch.no_grad():
            for i in range(num_items):
                idx = torch.tensor([i], device=device)
                gmf = model.item_embedding_gmf(idx)
                mlp = model.item_embedding_mlp(idx)
                emb = torch.cat([gmf, mlp], dim=-1).cpu().numpy().flatten()
                item_embeddings.append(emb)

        embeddings = np.array(item_embeddings, dtype=np.float32)
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(embeddings)

        faiss_path = f"{args.output}/faiss_index.bin"
        faiss.write_index(index, faiss_path)
        logger.info("Saved FAISS index (%d vectors) to %s", index.ntotal, faiss_path)
    except ImportError:
        logger.warning("FAISS not available — skipping index build")


if __name__ == "__main__":
    main()
```

---

## 8. CUDA Docker Variant

**File**: `scope_intel/Dockerfile.gpu` (NEW)

```dockerfile
# ── Stage 1: Build dependencies ──────────────────────────────
FROM nvidia/cuda:12.9.0-runtime-ubuntu24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3-pip curl && \
    rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.12 /usr/bin/python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu129

# ── Stage 2: Application ─────────────────────────────────────
COPY . /app

RUN addgroup --system --gid 10003 intel && \
    adduser --system --uid 10003 --ingroup intel intel && \
    chown -R intel:intel /app

USER intel
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=45s \
    CMD curl -fsS http://localhost:5000/api/intel/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "wsgi:app"]
```

**File**: `docker-compose.gpu.yml` (NEW — override file for GPU deployments)

```yaml
# Usage: docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build intel
services:
  intel:
    build:
      context: ./scope_intel
      dockerfile: Dockerfile.gpu
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    mem_limit: 2048m
```

---

## 9. Tests

**File**: `scope_intel/tests/test_sentiment.py` (NEW)

```python
"""Tests for sentiment analysis."""

import pytest


class TestSentimentInference:
    def test_positive_sentiment(self):
        from app.ml.inference.sentiment import analyze_sentiment
        result = analyze_sentiment("This place is absolutely amazing! Best food ever.")
        assert result["label"] == "POSITIVE"
        assert result["score"] > 0.8
        assert result["normalized_score"] > 0

    def test_negative_sentiment(self):
        from app.ml.inference.sentiment import analyze_sentiment
        result = analyze_sentiment("Terrible service, dirty tables, would never come back.")
        assert result["label"] == "NEGATIVE"
        assert result["normalized_score"] < 0

    def test_batch_sentiment(self):
        from app.ml.inference.sentiment import analyze_batch
        results = analyze_batch(["Great!", "Awful."])
        assert len(results) == 2
        assert results[0]["label"] == "POSITIVE"
        assert results[1]["label"] == "NEGATIVE"


class TestTripPredictor:
    def test_heuristic_prediction(self):
        from app.ml.inference.predictor import predict_trip
        result = predict_trip({"num_spots": 5, "total_distance_km": 100})
        assert result["predicted_days"] > 0
        assert result["predicted_cost_usd"] > 0
        assert result["source"] in ("xgboost", "heuristic")

    def test_missing_spots_uses_default(self):
        from app.ml.inference.predictor import predict_trip
        result = predict_trip({"num_spots": 1})
        assert result["predicted_days"] >= 0.5


class TestDeviceDetection:
    def test_device_info(self):
        from app.ml.device import device_info
        info = device_info()
        assert "device" in info
        assert "cuda_available" in info
        assert "torch_version" in info
```

---

## 10. .gitignore update

**File**: `scope_intel/app/ml/models/.gitignore` (NEW)

```
# Model artifacts are too large for git. Download or train locally.
*.pt
*.bin
*.json
*.joblib
*.pkl
!.gitkeep
```

---

## Validation Checklist

```powershell
# 1. Rebuild Intel API
docker compose up --build -d intel

# 2. Verify ML info endpoint
curl http://localhost/api/intel/ml/info

# 3. Test sentiment analysis
curl -X POST http://localhost/api/intel/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "This place is incredible, best view ever!"}'

# 4. Test image classification (with a URL)
curl -X POST http://localhost/api/intel/classify-image \
  -H "Content-Type: application/json" \
  -d '{"url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400"}'

# 5. Test trip prediction
curl -X POST http://localhost/api/intel/predict-trip \
  -H "Content-Type: application/json" \
  -d '{"num_spots": 5, "total_distance_km": 120, "avg_rating": 4.2, "month": 6}'

# 6. Run tests
cd scope_intel; python -m pytest tests/test_sentiment.py -v

# 7. (Optional) GPU build
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build intel
```

---

## Files Created / Modified Summary

| Action | File |
|---|---|
| MODIFY | `scope_intel/requirements.txt` |
| MODIFY | `scope_intel/app/__init__.py` (register new blueprints) |
| NEW | `scope_intel/app/ml/__init__.py` |
| NEW | `scope_intel/app/ml/device.py` |
| NEW | `scope_intel/app/ml/registry.py` |
| NEW | `scope_intel/app/ml/models/.gitkeep` |
| NEW | `scope_intel/app/ml/models/.gitignore` |
| NEW | `scope_intel/app/ml/training/__init__.py` |
| NEW | `scope_intel/app/ml/training/train_sentiment.py` |
| NEW | `scope_intel/app/ml/training/train_ncf.py` |
| NEW | `scope_intel/app/ml/training/train_tagger.py` (stub — follow train_sentiment pattern) |
| NEW | `scope_intel/app/ml/training/train_trip.py` (stub — follow XGBoost pattern) |
| NEW | `scope_intel/app/ml/inference/__init__.py` |
| NEW | `scope_intel/app/ml/inference/sentiment.py` |
| NEW | `scope_intel/app/ml/inference/tagger.py` |
| NEW | `scope_intel/app/ml/inference/recommender.py` |
| NEW | `scope_intel/app/ml/inference/predictor.py` |
| NEW | `scope_intel/app/routes/sentiment.py` |
| NEW | `scope_intel/app/routes/classify.py` |
| NEW | `scope_intel/app/routes/predict.py` |
| NEW | `scope_intel/app/routes/ml_health.py` |
| NEW | `scope_intel/Dockerfile.gpu` |
| NEW | `docker-compose.gpu.yml` |
| NEW | `scope_intel/tests/test_sentiment.py` |
