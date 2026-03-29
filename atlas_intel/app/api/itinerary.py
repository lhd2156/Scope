from flask import Blueprint, g, request
from app.auth import require_auth
from app.rate_limit import rate_limited
from app.repositories import IntelRepository
from app.responses import error_response, success_response
from app.schemas import ItineraryRequestSchema
from app.services.content_client import ContentServiceClient
from app.services.itinerary_engine import ItineraryEngine
from app.services.weather_service import WeatherService

itinerary_bp = Blueprint("itinerary", __name__)
itinerary_schema = ItineraryRequestSchema()
engine = ItineraryEngine(ContentServiceClient())
weather_service = WeatherService()

@itinerary_bp.post("/itinerary/generate")
@rate_limited
@require_auth
def generate_itinerary():
    payload = itinerary_schema.load(request.get_json() or {})
    weather = weather_service.get_planning_snapshot(payload["startDate"])
    itinerary = engine.generate(payload, weather)
    itinerary_id = IntelRepository.cache_itinerary(g.current_user["sub"], payload, itinerary)
    itinerary["id"] = itinerary_id
    return success_response(itinerary)

@itinerary_bp.get("/itinerary/<itinerary_id>")
@rate_limited
@require_auth
def get_itinerary(itinerary_id: str):
    itinerary = IntelRepository.get_itinerary(itinerary_id)
    if itinerary is None:
        return error_response(404, "NOT_FOUND", "Resource does not exist", trace_id=getattr(g, "trace_id", None))
    itinerary["id"] = itinerary_id
    return success_response(itinerary)
