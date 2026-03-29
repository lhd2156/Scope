from flask import Blueprint, request
from app.auth import require_auth
from app.rate_limit import rate_limited
from app.responses import success_response
from app.schemas import VibeMatchRequestSchema
from app.services.content_client import ContentServiceClient
from app.services.vibe_matcher import VibeMatcher

vibe_bp = Blueprint("vibe", __name__)
matcher = VibeMatcher(ContentServiceClient())
schema = VibeMatchRequestSchema()

@vibe_bp.post("/vibe-match")
@rate_limited
@require_auth
def vibe_match():
    payload = schema.load(request.get_json() or {})
    return success_response({"matches": matcher.match(payload["description"], payload["limit"])})
