from flask import Flask

from app.api.geocoding import geocoding_bp
from app.api.health import health_bp
from app.api.itinerary import itinerary_bp
from app.api.recommendations import recommendations_bp
from app.api.routing import routing_bp
from app.api.vibe import vibe_bp
from app.api.weather import weather_bp


def register_blueprints(app: Flask) -> None:
    for blueprint in [itinerary_bp, recommendations_bp, vibe_bp, routing_bp, weather_bp, geocoding_bp, health_bp]:
        app.register_blueprint(blueprint, url_prefix="/api/intel")
