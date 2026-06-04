"""Trip prediction API routes."""

from flask import Blueprint, jsonify, request

from app.auth import require_auth
from app.extensions import limiter
from app.ml.inference.predictor import predict_trip
from app.rate_limit import rate_limited

bp = Blueprint("predict", __name__, url_prefix="/api/intel")


@bp.route("/predict-trip", methods=["POST"])
@limiter.limit("20/minute")
@rate_limited
@require_auth
def predict():
    """Predict trip duration and cost."""
    data = request.get_json(silent=True) or {}

    required = ["num_spots"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    result = predict_trip(data)
    return jsonify(result)
