import os
from dataclasses import dataclass

@dataclass(slots=True)
class Settings:
    service_name: str = "atlas-intel"
    version: str = "1.0.0"
    flask_env: str = os.getenv("FLASK_ENV", "development")
    secret_key: str = os.getenv("FLASK_SECRET_KEY", "dev-secret")
    database_url: str = os.getenv("FLASK_DATABASE_URL", "sqlite:///atlas_intel.db")
    jwt_secret: str = os.getenv("CORE_JWT_SECRET", "super-secret-256-bit-key-change-in-prod")
    jwt_issuer: str = os.getenv("CORE_JWT_ISSUER", "atlas-core")
    jwt_audience: str = os.getenv("CORE_JWT_AUDIENCE", "atlas-frontend")
    kafka_bootstrap_servers: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    content_service_url: str = os.getenv("CONTENT_SERVICE_URL", "http://content:8000/api/content")
    weather_base_url: str = os.getenv("WEATHER_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    geocode_base_url: str = os.getenv("GEOCODE_BASE_URL", "https://geocoding-api.open-meteo.com/v1/search")
    reverse_geocode_base_url: str = os.getenv("REVERSE_GEOCODE_BASE_URL", "https://geocode.maps.co/reverse")
    itinerary_ttl_hours: int = int(os.getenv("ITINERARY_TTL_HOURS", "24"))
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

settings = Settings()
