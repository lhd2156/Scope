from flask import Flask

from app.api.geocoding import geocoding_bp
from app.api.fuel import fuel_bp
from app.api.health import health_bp
from app.api.place_verification import place_verification_bp
from app.api.itinerary import itinerary_bp
from app.api.place_photos import place_photos_bp
from app.api.recommendations import recommendations_bp
from app.api.routing import routing_bp
from app.api.travel import travel_bp
from app.api.vibe import vibe_bp
from app.api.weather import weather_bp


def register_blueprints(app: Flask) -> None:
    for blueprint in [itinerary_bp, recommendations_bp, vibe_bp, routing_bp, weather_bp, fuel_bp, place_photos_bp, place_verification_bp, travel_bp, geocoding_bp, health_bp]:
        app.register_blueprint(blueprint, url_prefix="/api/intel")
