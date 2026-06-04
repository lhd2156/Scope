from __future__ import annotations

import sys

import pandas as pd
import requests
import torch
from PIL import Image

from app.ml.inference import recommender
from app.ml.training import train_ncf, train_tagger


def test_ncf_model_forward_embedding_and_recommendation_paths(monkeypatch):
    model = recommender.NCFModel(num_users=3, num_items=4, embedding_dim=2)
    scores = model(torch.tensor([0, 1]), torch.tensor([2, 3]))
    assert scores.shape == (2,)
    assert model.get_user_embedding(1).shape == (4,)

    monkeypatch.setattr("app.ml.registry.load_ncf_model", lambda: None)
    monkeypatch.setattr(recommender, "_fallback_recommendations", lambda limit: [{"spot_id": "fallback", "score": 1.0, "source": "popularity"}])
    assert recommender.recommend_spots("user-1", limit=1)[0]["spot_id"] == "fallback"

    class FakeFaiss:
        def search(self, user_emb, limit):
            return [[0.0, 3.0, 5.0]], [[2, -1, 5]]

    class FakeModel:
        def get_user_embedding(self, user_idx):
            return [0.1, 0.2]

    monkeypatch.setattr("app.ml.registry.load_ncf_model", lambda: {"model": FakeModel(), "faiss_index": FakeFaiss()})
    monkeypatch.setattr(recommender, "_resolve_user_index", lambda user_id: 4)
    assert recommender.recommend_spots("user-1", limit=3) == [
        {"spot_id": "spot-2", "score": 1.0, "source": "ncf"},
        {"spot_id": "spot-5", "score": 0.1667, "source": "ncf"},
    ]

    monkeypatch.setattr(recommender, "_resolve_user_index", lambda user_id: None)
    assert recommender.recommend_spots("user-1", limit=1)[0]["spot_id"] == "fallback"


def test_fallback_recommendations_success_and_failure(monkeypatch):
    class GoodResponse:
        ok = True

        def json(self):
            return {"results": [{"id": "spot-1"}, {"id": "spot-2"}]}

    monkeypatch.setattr(requests, "get", lambda url, timeout: GoodResponse())
    assert recommender._fallback_recommendations(1) == [{"spot_id": "spot-1", "score": 1.0, "source": "popularity"}]

    monkeypatch.setattr(requests, "get", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline")))
    assert recommender._fallback_recommendations(3) == []

    assert isinstance(recommender._resolve_user_index("user-1"), int)
    assert recommender._resolve_spot_id(7) == "spot-7"


def test_train_ncf_main_writes_model(monkeypatch, tmp_path):
    data_path = tmp_path / "interactions.csv"
    output_dir = tmp_path / "models"
    pd.DataFrame(
        [
            {"user_id": "u1", "item_id": "s1", "rating": 5},
            {"user_id": "u2", "item_id": "s2", "rating": 5},
            {"user_id": "u1", "item_id": "s2", "rating": 5},
        ]
    ).to_csv(data_path, index=False)

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "train_ncf",
            "--data",
            str(data_path),
            "--output",
            str(output_dir),
            "--epochs",
            "1",
            "--batch-size",
            "2",
            "--embedding-dim",
            "2",
        ],
    )

    train_ncf.main()

    assert (output_dir / "ncf_model.pt").exists()


def test_travel_image_dataset_and_train_tagger_main(monkeypatch, tmp_path):
    image_root = tmp_path / "images"
    image_root.mkdir()
    for name in ["a.png", "b.png"]:
        Image.new("RGB", (4, 4), color="red").save(image_root / name)
    data_path = tmp_path / "images.csv"
    output_path = tmp_path / "tagger.pt"
    pd.DataFrame([{"path": "a.png", "label": "food"}, {"path": "b.png", "label": "scenic"}]).to_csv(data_path, index=False)

    dataset = train_tagger.TravelImageDataset(pd.read_csv(data_path), image_root, lambda image: "tensor")
    assert len(dataset) == 2
    assert dataset[0] == ("tensor", dataset.label_to_idx["food"])

    class FakeEfficientNet(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.classifier = torch.nn.ModuleList([torch.nn.Identity(), torch.nn.Linear(3, 1)])

        def forward(self, images):
            features = torch.ones((images.shape[0], 3), device=images.device)
            return self.classifier[1](features)

    monkeypatch.setattr(train_tagger.models, "efficientnet_b0", lambda weights=None: FakeEfficientNet())
    monkeypatch.setattr(train_tagger.transforms, "Compose", lambda steps: lambda image: torch.ones(3, 4, 4))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "train_tagger",
            "--data",
            str(data_path),
            "--image-root",
            str(image_root),
            "--output",
            str(output_path),
            "--epochs",
            "1",
            "--batch-size",
            "1",
        ],
    )

    train_tagger.main()

    assert output_path.exists()
