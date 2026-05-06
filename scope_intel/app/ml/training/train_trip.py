"""Train XGBoost trip duration and cost predictors.

Usage:
    python -m app.ml.training.train_trip --data trips.csv --output app/ml/models/
"""

import argparse
import logging
from pathlib import Path

import pandas as pd
import xgboost as xgb

logger = logging.getLogger(__name__)

FEATURE_NAMES = ["num_spots", "total_distance_km", "avg_rating", "num_outdoor", "num_food", "num_cultural", "month"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with feature columns plus 'duration_days' and 'cost_usd'")
    parser.add_argument("--output", default="app/ml/models/")
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    assert all(column in df.columns for column in FEATURE_NAMES)
    assert "duration_days" in df.columns and "cost_usd" in df.columns

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    x = df[FEATURE_NAMES]
    duration_model = xgb.XGBRegressor(objective="reg:squarederror", n_estimators=200, max_depth=4)
    duration_model.fit(x, df["duration_days"])
    duration_model.save_model(output_dir / "trip_duration.json")

    cost_model = xgb.XGBRegressor(objective="reg:squarederror", n_estimators=200, max_depth=4)
    cost_model.fit(x, df["cost_usd"])
    cost_model.save_model(output_dir / "trip_cost.json")

    logger.info("Saved trip predictor models to %s", output_dir)


if __name__ == "__main__":
    main()
