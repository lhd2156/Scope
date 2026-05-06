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

        self.user_embedding_gmf = nn.Embedding(num_users, embedding_dim)
        self.item_embedding_gmf = nn.Embedding(num_items, embedding_dim)

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

        self.predict = nn.Linear(embedding_dim + 32, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, user_ids: torch.Tensor, item_ids: torch.Tensor) -> torch.Tensor:
        gmf_user = self.user_embedding_gmf(user_ids)
        gmf_item = self.item_embedding_gmf(item_ids)
        gmf_out = gmf_user * gmf_item

        mlp_user = self.user_embedding_mlp(user_ids)
        mlp_item = self.item_embedding_mlp(item_ids)
        mlp_input = torch.cat([mlp_user, mlp_item], dim=-1)
        mlp_out = self.mlp(mlp_input)

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

    if faiss_index is None:
        return _fallback_recommendations(limit)

    try:
        import numpy as np

        user_idx = _resolve_user_index(user_id)
        if user_idx is None:
            return _fallback_recommendations(limit)

        user_emb = model.get_user_embedding(user_idx)
        user_emb = np.array([user_emb], dtype=np.float32)

        distances, indices = faiss_index.search(user_emb, limit)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0:
                continue
            spot_id = _resolve_spot_id(int(idx))
            results.append(
                {
                    "spot_id": spot_id,
                    "score": round(1.0 / (1.0 + float(dist)), 4),
                    "source": "ncf",
                }
            )

        return results

    except Exception:
        logger.exception("NCF recommendation failed, using fallback")
        return _fallback_recommendations(limit)


def _fallback_recommendations(limit: int) -> list[dict[str, Any]]:
    """Popularity-based fallback when NCF is unavailable."""
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
    try:
        return abs(hash(user_id)) % 10000
    except Exception:
        return None


def _resolve_spot_id(index: int) -> str:
    """Map model's internal item index back to external spot ID."""
    return f"spot-{index}"
