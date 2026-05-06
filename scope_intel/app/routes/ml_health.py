"""ML system health and info routes."""

from flask import Blueprint, jsonify

from app.ml.device import device_info
from app.ml.registry import _registry
from app.rate_limit import rate_limited

bp = Blueprint("ml_health", __name__, url_prefix="/api/intel/ml")


@bp.route("/info", methods=["GET"])
@rate_limited
def info():
    """Return ML system info: device, loaded models, versions."""
    return jsonify(
        {
            "device": device_info(),
            "loaded_models": list(_registry.keys()),
            "model_count": len(_registry),
        }
    )
