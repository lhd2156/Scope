from flask import Blueprint, request

from app.auth import require_auth
from app.cache_headers import WEATHER_CACHE_SECONDS, build_private_cache_headers
from app.rate_limit import rate_limited
from app.responses import success_response
from app.schemas import WeatherQuerySchema
from app.services.weather_service import WeatherService

weather_bp = Blueprint("weather", __name__)
service = WeatherService()
query_schema = WeatherQuerySchema()


@weather_bp.get("/weather")
@rate_limited
@require_auth
def get_weather():
    payload = query_schema.load(request.args)
    return success_response(
        service.get_forecast(payload["lat"], payload["lng"], payload["date"]),
        headers=build_private_cache_headers(WEATHER_CACHE_SECONDS),
    )
