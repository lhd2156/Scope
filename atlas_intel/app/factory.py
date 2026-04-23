import logging
import os

from flask import Flask

from app.api import register_blueprints
from app.cors_config import configure_cors
from app.errors import register_error_handlers
from app.extensions import db
from app.logging_config import configure_logging
from app.middleware import register_middleware
from app.telemetry import initialize_telemetry, register_metrics_endpoint
from config import settings

logger = logging.getLogger(__name__)


REQUIRED_CONFIG = {
    "SECRET_KEY": "FLASK_SECRET_KEY",
    "JWT_SECRET": "CORE_JWT_SECRET",
}


def create_app(test_config: dict | None = None) -> Flask:
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
        ML_REQUEST_TIMEOUT_SECONDS=settings.ml_request_timeout_seconds,
        JWT_SECRET=settings.jwt_secret,
        JWT_ISSUER=settings.jwt_issuer,
        JWT_AUDIENCE=settings.jwt_audience,
        KAFKA_BOOTSTRAP_SERVERS=settings.kafka_bootstrap_servers,
        CONTENT_SERVICE_URL=settings.content_service_url,
        WEATHER_BASE_URL=settings.weather_base_url,
        GEOCODE_BASE_URL=settings.geocode_base_url,
        REVERSE_GEOCODE_BASE_URL=settings.reverse_geocode_base_url,
        # Cap incoming bodies so an adversary cannot queue a gigantic upload to
        # pin a worker's memory or file descriptor. Intel only accepts small
        # JSON bodies; override via env if/when streaming endpoints land.
        MAX_CONTENT_LENGTH=int(os.getenv('INTEL_MAX_CONTENT_LENGTH', str(256 * 1024))),
    )
    if test_config:
        app.config.update(test_config)

    app.json.sort_keys = False

    missing = [env_name for key, env_name in REQUIRED_CONFIG.items() if not app.config.get(key)]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required Intel configuration: {joined}")

    configure_logging(app)
    initialize_telemetry()
    db.init_app(app)
    register_middleware(app)
    register_error_handlers(app)
    register_blueprints(app)
    register_metrics_endpoint(app)
    configure_cors(app)
    _configure_response_compression(app)

    with app.app_context():
        db.create_all()
        _warm_recommendation_index(app)

    return app


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
