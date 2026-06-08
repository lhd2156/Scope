import os
from dataclasses import dataclass
from pathlib import Path


def _load_local_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        os.environ[key] = value.strip().strip("\"'")


def _load_workspace_env() -> None:
    service_dir = Path(__file__).resolve().parent
    workspace_dir = service_dir.parent
    _load_local_env_file(workspace_dir / ".env")
    _load_local_env_file(service_dir / ".env")


_load_workspace_env()


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
    weather_geocode_base_url: str = os.getenv("WEATHER_GEOCODE_BASE_URL", "https://geocoding-api.open-meteo.com/v1/search")
    weather_provider_order: str = os.getenv("WEATHER_PROVIDER_ORDER", "nws,openweather,openmeteo")
    weather_cache_redis_url: str | None = os.getenv("WEATHER_CACHE_REDIS_URL")
    weather_current_cache_seconds: int = int(os.getenv("WEATHER_CURRENT_CACHE_SECONDS", "60"))
    weather_current_stale_seconds: int = int(os.getenv("WEATHER_CURRENT_STALE_SECONDS", "1800"))
    weather_nws_enabled: bool = os.getenv("WEATHER_NWS_ENABLED", "true").lower() == "true"
    weather_nws_base_url: str = os.getenv("WEATHER_NWS_BASE_URL", "https://api.weather.gov")
    weather_nws_user_agent: str = os.getenv("WEATHER_NWS_USER_AGENT", "Scope/1.0 (weather-cache; contact: ops@scope.local)")
    weather_nws_point_cache_seconds: int = int(os.getenv("WEATHER_NWS_POINT_CACHE_SECONDS", "86400"))
    openweathermap_api_key: str | None = os.getenv("OPENWEATHERMAP_API_KEY") or os.getenv("OPEN_WEATHER_MAP_API_KEY")
    openweathermap_base_url: str = os.getenv("OPENWEATHERMAP_BASE_URL", "https://api.openweathermap.org/data/2.5/weather")
    geocode_base_url: str = os.getenv("GEOCODE_BASE_URL", "https://geocode.maps.co/search")
    reverse_geocode_base_url: str = os.getenv("REVERSE_GEOCODE_BASE_URL", "https://geocode.maps.co/reverse")
    geocode_api_key: str | None = os.getenv("GEOCODE_API_KEY")
    mapbox_access_token: str | None = os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv("VITE_MAPBOX_ACCESS_TOKEN")
    google_places_api_key: str | None = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    google_places_base_url: str = os.getenv("GOOGLE_PLACES_BASE_URL", "https://places.googleapis.com/v1")
    google_places_cache_seconds: int = int(os.getenv("GOOGLE_PLACES_CACHE_SECONDS", "180"))
    google_places_usage_file: str | None = os.getenv("GOOGLE_PLACES_USAGE_FILE")
    google_places_usage_redis_url: str | None = os.getenv("GOOGLE_PLACES_USAGE_REDIS_URL")
    google_places_text_search_pro_monthly_cap: int = int(os.getenv("GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP", "5000"))
    google_places_place_details_photos_monthly_cap: int = int(os.getenv("GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP", "1000"))
    google_places_nearby_search_enterprise_monthly_cap: int = int(
        os.getenv("GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP", "1000")
    )
    google_places_nearby_search_enterprise_atmosphere_monthly_cap: int = int(
        os.getenv("GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP", "1000")
    )
    itinerary_ttl_hours: int = int(os.getenv("ITINERARY_TTL_HOURS", "24"))
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    fuel_rate_limit_per_minute: int = int(os.getenv("FUEL_RATE_LIMIT_PER_MINUTE", "20"))
    place_photo_rate_limit_per_minute: int = int(os.getenv("PLACE_PHOTO_RATE_LIMIT_PER_MINUTE", "30"))
    ml_request_timeout_seconds: float = float(os.getenv("ML_REQUEST_TIMEOUT_SECONDS", "5"))


settings = Settings()
