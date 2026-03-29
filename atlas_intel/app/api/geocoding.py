from flask import Blueprint, request
from app.auth import require_auth
from app.cache_headers import GEOCODE_CACHE_SECONDS, build_private_cache_headers
from app.rate_limit import rate_limited
from app.responses import success_response
from app.schemas import GeocodeQuerySchema, ReverseGeocodeQuerySchema
from app.services.geocoding_service import GeocodingService

geocoding_bp = Blueprint("geocoding", __name__)
service = GeocodingService()
geocode_query_schema = GeocodeQuerySchema()
reverse_geocode_query_schema = ReverseGeocodeQuerySchema()


@geocoding_bp.get("/geocode")
@rate_limited
@require_auth
def geocode():
    payload = geocode_query_schema.load(request.args)
    return success_response(service.geocode(payload["q"]), headers=build_private_cache_headers(GEOCODE_CACHE_SECONDS))


@geocoding_bp.get("/reverse-geocode")
@rate_limited
@require_auth
def reverse_geocode():
    payload = reverse_geocode_query_schema.load(request.args)
    return success_response(
        service.reverse_geocode(payload["lat"], payload["lng"]),
        headers=build_private_cache_headers(GEOCODE_CACHE_SECONDS),
    )
