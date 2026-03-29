from flask import Blueprint, request
from app.auth import require_auth
from app.ml.runtime import run_ml_with_timeout
from app.rate_limit import rate_limited
from app.responses import success_response
from app.schemas import RecommendationRequestSchema, SimilarRecommendationRequestSchema
from app.services.content_client import ContentServiceClient
from app.services.recommendation_engine import RecommendationEngine

recommendations_bp = Blueprint("recommendations", __name__)
request_schema = RecommendationRequestSchema()
similar_request_schema = SimilarRecommendationRequestSchema()
engine = RecommendationEngine(ContentServiceClient())

@recommendations_bp.post("/recommend/spots")
@rate_limited
@require_auth
def recommend_spots():
    payload = request_schema.load(request.get_json() or {})
    recommendations = run_ml_with_timeout(
        "recommend_spots",
        engine.recommend_spots,
        payload["userId"],
        payload["likedSpotIds"],
        payload["interests"],
        payload["limit"],
    )
    return success_response({"recommendations": recommendations})

@recommendations_bp.post("/recommend/similar/<spot_id>")
@rate_limited
@require_auth
def similar_spots(spot_id: str):
    payload = similar_request_schema.load(request.get_json(silent=True) or {})
    recommendations = run_ml_with_timeout("similar_spots", engine.similar_spots, spot_id, payload["limit"])
    return success_response({"recommendations": recommendations})
