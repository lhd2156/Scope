from flask import Blueprint, request

from app.auth import require_auth
from app.cache_headers import WEATHER_CACHE_SECONDS, build_private_cache_headers
from app.rate_limit import rate_limited
from app.responses import error_response, success_response
from app.schemas import CurrentWeatherQuerySchema, WeatherQuerySchema
from app.services.weather_service import WeatherService, WeatherUnavailableError

weather_bp = Blueprint("weather", __name__)
service = WeatherService()
query_schema = WeatherQuerySchema()
current_query_schema = CurrentWeatherQuerySchema()


@weather_bp.get("/weather")
@rate_limited
@require_auth
def get_weather():
    payload = query_schema.load(request.args)
    try:
        forecast = service.get_forecast(payload["lat"], payload["lng"], payload["date"])
    except WeatherUnavailableError:
        return error_response(
            503,
            "WEATHER_UNAVAILABLE",
            "Weather is unavailable right now.",
            [{"field": "weather", "message": "The configured weather provider did not return a usable forecast."}],
        )

    return success_response(forecast, headers=build_private_cache_headers(WEATHER_CACHE_SECONDS))


@weather_bp.get("/weather/current")
@rate_limited
@require_auth
def get_current_weather():
    payload = current_query_schema.load(request.args)
    try:
        snapshot = service.get_current_snapshot(payload.get("lat"), payload.get("lng"), payload.get("q"))
    except WeatherUnavailableError:
        return error_response(
            503,
            "WEATHER_UNAVAILABLE",
            "Weather is unavailable right now.",
            [{"field": "weather", "message": "The configured weather provider did not return a usable current snapshot."}],
        )

    return success_response(snapshot, headers=build_private_cache_headers(WEATHER_CACHE_SECONDS))
