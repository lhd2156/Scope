"""Trip duration and cost prediction using XGBoost."""

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parents[1] / "models"


def predict_trip(features: dict[str, Any]) -> dict[str, Any]:
    """Predict trip duration (days) and estimated cost."""
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

    duration_model = xgb.Booster()
    duration_model.load_model(str(duration_model_path))
    cost_model = xgb.Booster()
    cost_model.load_model(str(cost_model_path))

    feature_names = [
        "num_spots",
        "total_distance_km",
        "avg_rating",
        "num_outdoor",
        "num_food",
        "num_cultural",
        "month",
    ]
    x = np.array([[features.get(f, 0) for f in feature_names]], dtype=np.float32)
    dmatrix = xgb.DMatrix(x, feature_names=feature_names)

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
