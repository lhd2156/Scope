from flask import Blueprint, request
from app.auth import require_auth
from app.rate_limit import rate_limited
from app.responses import success_response
from app.services.geocoding_service import GeocodingService

geocoding_bp = Blueprint("geocoding", __name__)
service = GeocodingService()

@geocoding_bp.get("/geocode")
@rate_limited
@require_auth
def geocode():
    return success_response(service.geocode(request.args["q"]))

@geocoding_bp.get("/reverse-geocode")
@rate_limited
@require_auth
def reverse_geocode():
    return success_response(service.reverse_geocode(float(request.args["lat"]), float(request.args["lng"])))
