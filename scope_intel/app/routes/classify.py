"""Image classification API routes."""

import base64

from flask import Blueprint, jsonify, request

from app.extensions import limiter
from app.ml.inference.tagger import classify_from_url, classify_image
from app.rate_limit import rate_limited

bp = Blueprint("classify", __name__, url_prefix="/api/intel")


@bp.route("/classify-image", methods=["POST"])
@limiter.limit("20/minute")
@rate_limited
def classify():
    """Classify an image and return auto-tags."""
    top_k = 5
    data = request.get_json(silent=True) or {}

    if data.get("top_k"):
        top_k = min(int(data["top_k"]), 20)

    if "url" in data:
        tags = classify_from_url(data["url"], top_k)
        return jsonify({"tags": tags, "photo_id": data.get("photo_id")})

    if "image_base64" in data:
        image_bytes = base64.b64decode(data["image_base64"])
        tags = classify_image(image_bytes, top_k)
        return jsonify({"tags": tags, "photo_id": data.get("photo_id")})

    if "image" in request.files:
        image_bytes = request.files["image"].read()
        tags = classify_image(image_bytes, top_k)
        return jsonify({"tags": tags})

    return jsonify({"error": "Provide 'url', 'image_base64', or file upload"}), 400
