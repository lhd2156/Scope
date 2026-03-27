from flask import Blueprint, request
from app.auth import require_auth
from app.responses import success_response
from app.schemas import RouteOptimizeRequestSchema
from app.services.route_optimizer import RouteOptimizer

routing_bp = Blueprint("routing", __name__)
optimizer = RouteOptimizer()
schema = RouteOptimizeRequestSchema()

@routing_bp.post("/route/optimize")
@require_auth
def optimize_route():
    payload = schema.load(request.get_json() or {})
    return success_response(optimizer.optimize(payload["spots"], payload.get("startLat"), payload.get("startLng")))
