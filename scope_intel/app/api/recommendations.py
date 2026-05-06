from flask import Blueprint, g, request

from app.auth import require_auth
from app.extensions import limiter
from app.ml.runtime import run_ml_with_timeout
from app.rate_limit import rate_limited
from app.repositories import IntelRepository
from app.responses import error_response, success_response
from app.schemas import (
    NcfRecommendationRequestSchema,
    RecommendationFeedbackSchema,
    RecommendationRequestSchema,
    SimilarRecommendationRequestSchema,
)
from app.services.content_client import ContentServiceClient
from app.services.recommendation_engine import RecommendationEngine

recommendations_bp = Blueprint("recommendations", __name__)
request_schema = RecommendationRequestSchema()
similar_request_schema = SimilarRecommendationRequestSchema()
feedback_schema = RecommendationFeedbackSchema()
ncf_request_schema = NcfRecommendationRequestSchema()
engine = RecommendationEngine(ContentServiceClient())


def _jwt_subject() -> str | None:
    subject = (g.current_user or {}).get("sub")
    return str(subject) if subject else None


def _resolve_request_user_id(payload: dict) -> tuple[str | None, object | None]:
    subject = _jwt_subject()
    if not subject:
        return None, error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))

    requested_user_id = payload.get("userId")
    if requested_user_id and requested_user_id != subject:
        return None, error_response(
            403,
            "FORBIDDEN",
            "Insufficient permissions",
            [{"field": "userId", "message": "Must match authenticated user"}],
            getattr(g, "trace_id", None),
        )

    return subject, None


@recommendations_bp.post("/recommend/spots")
@limiter.limit("20/minute")
@rate_limited
@require_auth
def recommend_spots():
    payload = request_schema.load(request.get_json() or {})
    user_id, failure = _resolve_request_user_id(payload)
    if failure is not None:
        return failure

    recommendations = run_ml_with_timeout(
        "recommend_spots",
        engine.recommend_spots,
        user_id,
        payload["likedSpotIds"],
        payload["interests"],
        payload["limit"],
    )
    return success_response({"recommendations": recommendations})

@recommendations_bp.post("/recommend/similar/<spot_id>")
@limiter.limit("20/minute")
@rate_limited
@require_auth
def similar_spots(spot_id: str):
    payload = similar_request_schema.load(request.get_json(silent=True) or {})
    recommendations = run_ml_with_timeout("similar_spots", engine.similar_spots, spot_id, payload["limit"])
    return success_response({"recommendations": recommendations})


@recommendations_bp.post("/recommend/feedback")
@rate_limited
@require_auth
def recommend_feedback():
    """Record user feedback on a served recommendation.

    The body is {"spotId": str, "action": "click"|"dismiss"}. We trust the JWT
    subject as the source of truth for `user_id` so clients can't spoof
    feedback against other users' audit rows.

    We intentionally return 200 even when no audit row exists (stale session,
    recs were served before the audit table shipped, etc.) because the client
    has already taken the UX action and retrying will not make a missing row
    appear. The `updated` flag lets callers log when this happens.
    """
    payload = feedback_schema.load(request.get_json() or {})
    subject = _jwt_subject()
    if not subject:
        return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))

    updated = IntelRepository.mark_recommendation_feedback(
        user_id=subject,
        spot_id=payload["spotId"],
        action=payload["action"],
    )
    return success_response({"updated": updated})


@recommendations_bp.post("/recommend/ncf")
@limiter.limit("20/minute")
@rate_limited
@require_auth
def recommend_ncf():
    """Return Neural Collaborative Filtering recommendations."""
    from app.ml.inference.recommender import recommend_spots as recommend_ncf_spots

    payload = ncf_request_schema.load(request.get_json() or {})
    user_id, failure = _resolve_request_user_id(payload)
    if failure is not None:
        return failure

    limit = payload["limit"]
    recommendations = run_ml_with_timeout("recommend_ncf", recommend_ncf_spots, str(user_id), limit)
    return success_response({"recommendations": recommendations})
