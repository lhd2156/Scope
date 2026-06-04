"""Sentiment analysis API routes."""

from flask import Blueprint, jsonify, request

from app.auth import require_auth
from app.extensions import limiter
from app.ml.inference.sentiment import analyze_batch, analyze_sentiment
from app.rate_limit import rate_limited

bp = Blueprint("sentiment", __name__, url_prefix="/api/intel/sentiment")


@bp.route("", methods=["POST"])
@limiter.limit("20/minute")
@rate_limited
@require_auth
def sentiment():
    """Analyze sentiment of text."""
    data = request.get_json(silent=True) or {}

    if "text" in data:
        result = analyze_sentiment(data["text"])
        result["review_id"] = data.get("review_id")
        return jsonify(result)

    if "texts" in data:
        results = analyze_batch(data["texts"])
        return jsonify({"results": results})

    return jsonify({"error": "Provide 'text' or 'texts' in request body"}), 400
