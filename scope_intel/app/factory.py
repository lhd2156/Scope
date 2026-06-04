import logging
import os

from flask import Flask

try:
    import sentry_sdk
except ImportError:  # pragma: no cover - dependency is installed in Docker
    sentry_sdk = None

from app.api import register_blueprints
from app.cors_config import configure_cors
from app.errors import register_error_handlers
from app.extensions import db, limiter, _limiter_storage_uri
from app.logging_config import configure_logging
from app.middleware import register_middleware
from app.routes.classify import bp as classify_bp
from app.routes.ml_health import bp as ml_health_bp
from app.routes.predict import bp as predict_bp
from app.routes.sentiment import bp as sentiment_bp
from app.routes.agent import bp as agent_bp
from app.telemetry import initialize_telemetry, register_metrics_endpoint
from config import settings

logger = logging.getLogger(__name__)
_SENTRY_INITIALIZED = False


REQUIRED_CONFIG = {
    "SECRET_KEY": "FLASK_SECRET_KEY",
    "JWT_SECRET": "CORE_JWT_SECRET",
}


def _float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return min(max(value, 0.0), 1.0)


def create_app(test_config: dict | None = None) -> Flask:
    _initialize_sentry()
    app = Flask(__name__)
    # SQLAlchemy engine options tuned for long-lived gunicorn workers behind a
    # network-attached RDBMS:
    #   * pool_pre_ping validates each connection before handing it out so that
    #     a stale/dropped TCP (e.g. DB failover, NLB idle timeout) doesn't turn
    #     into a user-visible 500.
    #   * pool_recycle forces connections to be recycled before the DB server
    #     or intermediate proxy closes them out from under us (typical idle
    #     timeouts are 5-10 min).
    #   * pool_size / max_overflow are sized per-worker; total sockets per
    #     replica = workers * (pool_size + max_overflow), so keep defaults
    #     conservative and tune via env.
    engine_options: dict = {
        'pool_pre_ping': True,
        'pool_recycle': int(os.getenv('SQLALCHEMY_POOL_RECYCLE', '280')),
    }
    # Pool sizing options are only meaningful for server-based databases; the
    # default sqlite pool class (SingletonThreadPool) rejects pool_size and
    # max_overflow, so we only set them for non-sqlite URLs.
    if settings.database_url and not settings.database_url.startswith('sqlite'):
        engine_options['pool_size'] = int(os.getenv('SQLALCHEMY_POOL_SIZE', '5'))
        engine_options['max_overflow'] = int(os.getenv('SQLALCHEMY_MAX_OVERFLOW', '10'))
        engine_options['pool_timeout'] = int(os.getenv('SQLALCHEMY_POOL_TIMEOUT', '30'))

    app.config.update(
        SECRET_KEY=settings.secret_key,
        FLASK_ENV=settings.flask_env,
        FRONTEND_ORIGIN=settings.frontend_origin,
        DEVELOPMENT_FRONTEND_ORIGIN=settings.development_frontend_origin,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS=engine_options,
        RATE_LIMIT_PER_MINUTE=settings.rate_limit_per_minute,
        RATELIMIT_ENABLED=os.getenv("INTEL_RATE_LIMIT_ENABLED", "true").lower() == "true",
        RATELIMIT_STORAGE_URI=_limiter_storage_uri(),
        RATELIMIT_DEFAULT=["100/minute"],
        ML_REQUEST_TIMEOUT_SECONDS=settings.ml_request_timeout_seconds,
        ML_IMAGE_FETCH_TIMEOUT_SECONDS=float(os.getenv('ML_IMAGE_FETCH_TIMEOUT_SECONDS', '10')),
        ML_IMAGE_FETCH_MAX_BYTES=int(os.getenv('ML_IMAGE_FETCH_MAX_BYTES', str(5 * 1024 * 1024))),
        ML_IMAGE_FETCH_MAX_REDIRECTS=int(os.getenv('ML_IMAGE_FETCH_MAX_REDIRECTS', '3')),
        JWT_SECRET=settings.jwt_secret,
        JWT_ISSUER=settings.jwt_issuer,
        JWT_AUDIENCE=settings.jwt_audience,
        KAFKA_BOOTSTRAP_SERVERS=settings.kafka_bootstrap_servers,
        CONTENT_SERVICE_URL=settings.content_service_url,
        WEATHER_BASE_URL=settings.weather_base_url,
        WEATHER_GEOCODE_BASE_URL=settings.weather_geocode_base_url,
        WEATHER_PROVIDER_ORDER=settings.weather_provider_order,
        WEATHER_CACHE_REDIS_URL=settings.weather_cache_redis_url,
        WEATHER_CURRENT_CACHE_SECONDS=settings.weather_current_cache_seconds,
        WEATHER_CURRENT_STALE_SECONDS=settings.weather_current_stale_seconds,
        WEATHER_NWS_ENABLED=settings.weather_nws_enabled,
        WEATHER_NWS_BASE_URL=settings.weather_nws_base_url,
        WEATHER_NWS_USER_AGENT=settings.weather_nws_user_agent,
        WEATHER_NWS_POINT_CACHE_SECONDS=settings.weather_nws_point_cache_seconds,
        OPENWEATHERMAP_API_KEY=settings.openweathermap_api_key,
        OPENWEATHERMAP_BASE_URL=settings.openweathermap_base_url,
        GEOCODE_BASE_URL=settings.geocode_base_url,
        REVERSE_GEOCODE_BASE_URL=settings.reverse_geocode_base_url,
        GEOCODE_API_KEY=settings.geocode_api_key,
        MAPBOX_ACCESS_TOKEN=settings.mapbox_access_token,
        GOOGLE_PLACES_API_KEY=settings.google_places_api_key,
        GOOGLE_PLACES_BASE_URL=settings.google_places_base_url,
        GOOGLE_PLACES_CACHE_SECONDS=settings.google_places_cache_seconds,
        GOOGLE_PLACES_USAGE_FILE=settings.google_places_usage_file,
        GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_CAP=settings.google_places_text_search_pro_monthly_cap,
        GOOGLE_PLACES_PLACE_DETAILS_PHOTOS_MONTHLY_CAP=settings.google_places_place_details_photos_monthly_cap,
        GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_MONTHLY_CAP=settings.google_places_nearby_search_enterprise_monthly_cap,
        GOOGLE_PLACES_NEARBY_SEARCH_ENTERPRISE_ATMOSPHERE_MONTHLY_CAP=settings.google_places_nearby_search_enterprise_atmosphere_monthly_cap,
        FUEL_RATE_LIMIT_PER_MINUTE=settings.fuel_rate_limit_per_minute,
        PLACE_PHOTO_RATE_LIMIT_PER_MINUTE=settings.place_photo_rate_limit_per_minute,
        # Cap incoming bodies so an adversary cannot queue a gigantic upload to
        # pin a worker's memory or file descriptor. Intel only accepts small
        # JSON bodies; override via env if/when streaming endpoints land.
        MAX_CONTENT_LENGTH=int(os.getenv('INTEL_MAX_CONTENT_LENGTH', str(256 * 1024))),
    )
    if test_config:
        app.config.update(test_config)
    using_memory_database = app.config.get("SQLALCHEMY_DATABASE_URI") == "sqlite:///:memory:"
    if (app.config.get("TESTING") or using_memory_database) and not (test_config and "RATELIMIT_STORAGE_URI" in test_config):
        app.config["RATELIMIT_STORAGE_URI"] = "memory://"
    if app.config.get("TESTING") and not (test_config and "RATELIMIT_ENABLED" in test_config):
        app.config["RATELIMIT_ENABLED"] = False

    app.json.sort_keys = False

    missing = [env_name for key, env_name in REQUIRED_CONFIG.items() if not app.config.get(key)]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required Intel configuration: {joined}")

    configure_logging(app)
    initialize_telemetry()
    db.init_app(app)
    limiter.init_app(app)
    register_middleware(app)
    register_error_handlers(app)
    register_blueprints(app)
    app.register_blueprint(sentiment_bp)
    app.register_blueprint(classify_bp)
    app.register_blueprint(predict_bp)
    app.register_blueprint(ml_health_bp)
    app.register_blueprint(agent_bp)
    register_metrics_endpoint(app)
    configure_cors(app)
    _configure_response_compression(app)

    with app.app_context():
        db.create_all()
        _warm_recommendation_index(app)

    _start_grpc_if_enabled(app)

    return app


def _initialize_sentry() -> None:
    global _SENTRY_INITIALIZED
    if _SENTRY_INITIALIZED or sentry_sdk is None:
        return
    sentry_dsn = os.environ.get("SENTRY_DSN", "")
    if not sentry_dsn:
        return
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=_float_env("SENTRY_TRACES_SAMPLE_RATE", 0.1),
        profiles_sample_rate=_float_env("SENTRY_PROFILES_SAMPLE_RATE", 0.1),
        environment=os.environ.get("SENTRY_ENVIRONMENT") or os.environ.get("FLASK_ENV", "development"),
        release=os.environ.get("SENTRY_RELEASE") or None,
        send_default_pii=False,
    )
    _SENTRY_INITIALIZED = True


def _configure_response_compression(app: Flask) -> None:
    """Enable Brotli/Gzip response compression for JSON + SSE payloads.

    Flask-Compress is imported lazily so the module stays importable in test
    environments where the dependency may not be installed. When missing, we
    log once and continue; compression can then be added at the edge (nginx)
    without breaking startup.
    """
    if os.getenv("INTEL_COMPRESSION_ENABLED", "true").lower() != "true":
        return
    try:
        from flask_compress import Compress
    except ImportError:
        logger.info("intel_compression_flask_compress_missing_skipping")
        return

    # JSON-only allowlist matches our API shape; text/event-stream covers any
    # future SSE rec-stream endpoint. Level 5 keeps Brotli CPU cost under 2ms
    # on typical 10-30KB rec payloads while still cutting bytes by ~70%.
    app.config.setdefault("COMPRESS_MIMETYPES", [
        "application/json",
        "application/problem+json",
        "text/event-stream",
    ])
    app.config.setdefault("COMPRESS_LEVEL", int(os.getenv("INTEL_COMPRESS_LEVEL", "5")))
    app.config.setdefault("COMPRESS_BR_LEVEL", int(os.getenv("INTEL_COMPRESS_BR_LEVEL", "5")))
    app.config.setdefault("COMPRESS_MIN_SIZE", int(os.getenv("INTEL_COMPRESS_MIN_BYTES", "500")))
    app.config.setdefault("COMPRESS_ALGORITHM", ["br", "gzip"])
    Compress(app)


def _warm_recommendation_index(app: Flask) -> None:
    """Best-effort warmup so the first request doesn't pay the TF-IDF fit cost.

    Gated behind INTEL_WARMUP_RECOMMENDATIONS because in --preload mode gunicorn
    runs create_app in the master process before forking workers; if Content is
    reachable at master-boot we can build the index once and every forked
    worker inherits it via copy-on-write. If Content isn't reachable yet we
    swallow the error: the request path already rebuilds on demand.
    """
    if os.getenv("INTEL_WARMUP_RECOMMENDATIONS", "true").lower() != "true":
        return
    if app.config.get("TESTING"):
        return
    try:
        from app.services.content_client import ContentServiceClient
        from app.services.recommendation_engine import RecommendationEngine

        engine = RecommendationEngine(ContentServiceClient())
        engine._get_spot_similarity_index()
        logger.info("intel_warmup_recommendations_complete")
    except Exception:  # noqa: BLE001 — warmup must never block boot
        logger.warning("intel_warmup_recommendations_failed", exc_info=True)


def _start_grpc_if_enabled(app: Flask) -> None:
    """Start the internal Intel gRPC server during app startup."""
    if app.config.get("TESTING"):
        return
    if os.getenv("GRPC_ENABLED", "false").lower() != "true":
        return

    try:
        from app.grpc_server import start_grpc_background

        start_grpc_background()
    except Exception:
        logger.warning("intel_grpc_start_failed", exc_info=True)
