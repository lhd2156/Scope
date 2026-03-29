from flask import Flask
from app.api import register_blueprints
from app.cors_config import configure_cors
from app.errors import register_error_handlers
from app.extensions import db
from app.logging_config import configure_logging
from app.middleware import register_middleware
from config import settings


REQUIRED_CONFIG = {
    "SECRET_KEY": "FLASK_SECRET_KEY",
    "JWT_SECRET": "CORE_JWT_SECRET",
}


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=settings.secret_key,
        FLASK_ENV=settings.flask_env,
        FRONTEND_ORIGIN=settings.frontend_origin,
        DEVELOPMENT_FRONTEND_ORIGIN=settings.development_frontend_origin,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
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
    )
    if test_config:
        app.config.update(test_config)

    missing = [env_name for key, env_name in REQUIRED_CONFIG.items() if not app.config.get(key)]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required Intel configuration: {joined}")

    configure_logging(app)
    db.init_app(app)
    register_middleware(app)
    register_error_handlers(app)
    register_blueprints(app)
    configure_cors(app)

    with app.app_context():
        db.create_all()

    return app
