from datetime import date
from flask import Blueprint, request
from app.auth import require_auth
from app.responses import success_response
from app.services.weather_service import WeatherService

weather_bp = Blueprint("weather", __name__)
service = WeatherService()

@weather_bp.get("/weather")
@require_auth
def get_weather():
    latitude = float(request.args["lat"])
    longitude = float(request.args["lng"])
    target_date = date.fromisoformat(request.args["date"])
    return success_response(service.get_forecast(latitude, longitude, target_date))
