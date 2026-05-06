import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    service_name: str = "scope-intel"
    version: str = "1.0.0"
    flask_env: str = os.getenv("FLASK_ENV", "development")
    frontend_origin: str | None = os.getenv("FRONTEND_ORIGIN") or os.getenv("CORE_FRONTEND_ORIGIN")
    development_frontend_origin: str = "http://localhost:5173"
    secret_key: str | None = os.getenv("FLASK_SECRET_KEY")
    database_url: str = os.getenv("FLASK_DATABASE_URL", "sqlite:///scope_intel.db")
    jwt_secret: str | None = os.getenv("CORE_JWT_SECRET")
    jwt_issuer: str = os.getenv("CORE_JWT_ISSUER", "scope-core")
    jwt_audience: str = os.getenv("CORE_JWT_AUDIENCE", "scope-frontend")
    kafka_bootstrap_servers: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    content_service_url: str = os.getenv("CONTENT_SERVICE_URL", "http://content:8000/api/content")
    weather_base_url: str = os.getenv("WEATHER_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    geocode_base_url: str = os.getenv("GEOCODE_BASE_URL", "https://geocode.maps.co/search")
    reverse_geocode_base_url: str = os.getenv("REVERSE_GEOCODE_BASE_URL", "https://geocode.maps.co/reverse")
    geocode_api_key: str | None = os.getenv("GEOCODE_API_KEY")
    mapbox_access_token: str | None = os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("VITE_MAPBOX_ACCESS_TOKEN")
    itinerary_ttl_hours: int = int(os.getenv("ITINERARY_TTL_HOURS", "24"))
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    ml_request_timeout_seconds: float = float(os.getenv("ML_REQUEST_TIMEOUT_SECONDS", "5"))


settings = Settings()
