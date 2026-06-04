from __future__ import annotations

import base64
from io import BytesIO
from types import SimpleNamespace

import pytest
import torch
import torchvision.models as tv_models
import torchvision.transforms as tv_transforms
import xgboost as xgb
from PIL import Image

from app.ml import registry
from app.ml.inference import predictor, sentiment, tagger


@pytest.fixture(autouse=True)
def clear_model_registry():
    registry._registry.clear()
    yield
    registry._registry.clear()


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (3, 3), color="green").save(buffer, format="PNG")
    return buffer.getvalue()


def test_registry_loaders_and_device_branches(monkeypatch, tmp_path):
    registry._registry.clear()
    registry.register_model("manual", {"ok": True})
    assert registry.get_model("manual") == {"ok": True}

    monkeypatch.setattr("app.ml.device.get_device", lambda: torch.device("cpu"))
    monkeypatch.setattr("transformers.pipeline", lambda *args, **kwargs: {"pipeline": kwargs})
    sentiment_model = registry.load_sentiment_model()
    assert registry.load_sentiment_model() is sentiment_model
    assert sentiment_model["pipeline"]["device"] == -1

    class FakeVisionModel(torch.nn.Module):
        def eval(self):
            return self

    monkeypatch.setattr(tv_models, "efficientnet_b0", lambda weights=None: FakeVisionModel())
    monkeypatch.setattr(tv_transforms, "Compose", lambda steps: lambda image: torch.ones(3, 3, 3))
    registry._registry.pop("tagger", None)
    tagger_payload = registry.load_tagger_model()
    assert len(tagger_payload["categories"]) > 5
    assert registry.load_tagger_model() is tagger_payload

    registry._registry.pop("ncf", None)
    monkeypatch.setattr(registry, "MODELS_DIR", tmp_path)
    assert registry.load_ncf_model() is None

    from app.ml.inference.recommender import NCFModel

    checkpoint_model = NCFModel(1, 1, 2)
    torch.save(
        {
            "state_dict": checkpoint_model.state_dict(),
            "num_users": 1,
            "num_items": 1,
            "embedding_dim": 2,
        },
        tmp_path / "ncf_model.pt",
    )
    (tmp_path / "faiss_index.bin").write_text("index")
    monkeypatch.setitem(__import__("sys").modules, "faiss", SimpleNamespace(read_index=lambda path: SimpleNamespace(ntotal=1)))
    registry._registry.pop("ncf", None)
    assert registry.load_ncf_model()["faiss_index"].ntotal == 1


def test_inference_sentiment_tagger_predictor_paths(monkeypatch, tmp_path):
    monkeypatch.setattr("app.ml.registry.load_sentiment_model", lambda: lambda text, **kwargs: [{"label": "NEGATIVE", "score": 0.91}] if isinstance(text, str) else [{"label": "POSITIVE", "score": 0.88} for _ in text])
    assert sentiment.analyze_sentiment("bad") == {"label": "NEGATIVE", "score": 0.91, "normalized_score": -0.91}
    assert sentiment.analyze_batch(["great"])[0]["normalized_score"] == 0.88

    monkeypatch.setattr("app.ml.registry.load_sentiment_model", lambda: (_ for _ in ()).throw(ImportError("missing")))
    assert sentiment.analyze_sentiment("amazing clean perfect")["label"] == "POSITIVE"
    assert sentiment.analyze_sentiment("awful rude worst")["label"] == "NEGATIVE"
    assert sentiment.analyze_batch(["bad", "great"])[0]["label"] == "NEGATIVE"

    class FakeTaggerModel(torch.nn.Module):
        def forward(self, tensor):
            return torch.tensor([[5.0, 2.0, 5.0, 1.0]])

    monkeypatch.setattr(
        "app.ml.registry.load_tagger_model",
        lambda: {
            "model": FakeTaggerModel(),
            "transform": lambda image: torch.ones(3, 3, 3),
            "categories": ["beach", "park"],
            "device": torch.device("cpu"),
        },
    )
    tags = tagger.classify_image(_png_bytes(), top_k=2)
    assert [item["tag"] for item in tags] == ["beach", "park"]

    class ImageResponse:
        status = 200
        headers = {"Content-Type": "image/png", "Content-Length": str(len(_png_bytes()))}

        def close(self):
            return None

        def iter_content(self, chunk_size):
            yield _png_bytes()

    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: ImageResponse())
    assert tagger.classify_from_url("https://8.8.8.8/image.png", top_k=1)[0]["tag"] == "beach"

    monkeypatch.setattr(predictor, "MODELS_DIR", tmp_path)
    assert predictor.predict_trip({"num_spots": 2, "total_distance_km": 300})["source"] == "heuristic"
    (tmp_path / "trip_duration.json").write_text("{}")
    (tmp_path / "trip_cost.json").write_text("{}")

    class FakeBooster:
        def __init__(self):
            self.path = None

        def load_model(self, path):
            self.path = path

        def predict(self, dmatrix):
            return [-1.0] if "duration" in self.path else [123.456]

    monkeypatch.setattr(xgb, "Booster", FakeBooster)
    monkeypatch.setattr(xgb, "DMatrix", lambda x, feature_names: {"x": x, "feature_names": feature_names})
    predicted = predictor.predict_trip({"num_spots": 2, "month": 6})
    assert predicted == {"predicted_days": 0.5, "predicted_cost_usd": 123.46, "confidence": 0.75, "source": "xgboost"}


def test_classify_predict_and_sentiment_routes(client, auth_header, monkeypatch):
    monkeypatch.setattr("app.routes.classify.classify_from_url", lambda url, top_k, **kwargs: [{"tag": "url", "confidence": 0.9}])
    monkeypatch.setattr("app.routes.classify.classify_image", lambda image_bytes, top_k: [{"tag": "bytes", "confidence": 0.8}])
    monkeypatch.setattr("app.routes.predict.predict_trip", lambda data: {"predicted_days": 2, "source": "test"})
    monkeypatch.setattr("app.routes.sentiment.analyze_sentiment", lambda text: {"label": "POSITIVE", "score": 0.9, "normalized_score": 0.9})
    monkeypatch.setattr("app.routes.sentiment.analyze_batch", lambda texts: [{"label": "NEGATIVE", "score": 0.8, "normalized_score": -0.8}])

    assert client.post("/api/intel/classify-image", headers=auth_header, json={"url": "https://image", "top_k": 99, "photo_id": "p"}).get_json()["tags"][0]["tag"] == "url"
    encoded = base64.b64encode(b"raw").decode("ascii")
    assert client.post("/api/intel/classify-image", headers=auth_header, json={"image_base64": encoded}).get_json()["tags"][0]["tag"] == "bytes"
    upload = {"image": (BytesIO(b"raw"), "photo.png")}
    assert client.post("/api/intel/classify-image", headers=auth_header, data=upload, content_type="multipart/form-data").get_json()["tags"][0]["tag"] == "bytes"
    assert client.post("/api/intel/classify-image", headers=auth_header, json={}).status_code == 400

    assert client.post("/api/intel/predict-trip", headers=auth_header, json={}).status_code == 400
    assert client.post("/api/intel/predict-trip", headers=auth_header, json={"num_spots": 3}).get_json()["source"] == "test"

    assert client.post("/api/intel/sentiment", headers=auth_header, json={"text": "great", "review_id": "r"}).get_json()["review_id"] == "r"
    assert client.post("/api/intel/sentiment", headers=auth_header, json={"texts": ["bad"]}).get_json()["results"][0]["label"] == "NEGATIVE"
    assert client.post("/api/intel/sentiment", headers=auth_header, json={}).status_code == 400
