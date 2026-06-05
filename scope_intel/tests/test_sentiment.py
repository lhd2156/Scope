"""Tests for sentiment analysis."""


class TestSentimentInference:
    def test_positive_sentiment(self, monkeypatch):
        from app.ml import registry
        from app.ml.inference.sentiment import analyze_sentiment

        monkeypatch.setattr(registry, "load_sentiment_model", lambda: (_ for _ in ()).throw(ImportError("offline")))
        result = analyze_sentiment("This place is absolutely amazing! Best food ever.")
        assert result["label"] == "POSITIVE"
        assert result["score"] > 0.8
        assert result["normalized_score"] > 0

    def test_negative_sentiment(self, monkeypatch):
        from app.ml import registry
        from app.ml.inference.sentiment import analyze_sentiment

        monkeypatch.setattr(registry, "load_sentiment_model", lambda: (_ for _ in ()).throw(ImportError("offline")))
        result = analyze_sentiment("Terrible service, dirty tables, would never come back.")
        assert result["label"] == "NEGATIVE"
        assert result["normalized_score"] < 0

    def test_batch_sentiment(self, monkeypatch):
        from app.ml import registry
        from app.ml.inference.sentiment import analyze_batch

        monkeypatch.setattr(registry, "load_sentiment_model", lambda: (_ for _ in ()).throw(ImportError("offline")))
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
