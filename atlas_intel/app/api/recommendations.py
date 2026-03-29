from flask import Blueprint, request
from app.auth import require_auth
from app.rate_limit import rate_limited
from app.responses import success_response
from app.schemas import RecommendationRequestSchema
from app.services.content_client import ContentServiceClient
from app.services.recommendation_engine import RecommendationEngine

recommendations_bp = Blueprint("recommendations", __name__)
request_schema = RecommendationRequestSchema()
engine = RecommendationEngine(ContentServiceClient())

@recommendations_bp.post("/recommend/spots")
@rate_limited
@require_auth
def recommend_spots():
    payload = request_schema.load(request.get_json() or {})
    recommendations = engine.recommend_spots(payload["userId"], payload["likedSpotIds"], payload["interests"], payload["limit"])
    return success_response({"recommendations": recommendations})

@recommendations_bp.post("/recommend/similar/<spot_id>")
@rate_limited
@require_auth
def similar_spots(spot_id: str):
    limit = int((request.get_json(silent=True) or {}).get("limit", 5))
    return success_response({"recommendations": engine.similar_spots(spot_id, limit=limit)})
