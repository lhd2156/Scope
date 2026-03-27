from flask import Flask
from app.api import register_blueprints
from app.errors import register_error_handlers
from app.extensions import db
from app.logging_config import configure_logging
from app.middleware import register_middleware
from config import settings


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=settings.secret_key,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        RATE_LIMIT_PER_MINUTE=settings.rate_limit_per_minute,
    )
    if test_config:
        app.config.update(test_config)

    configure_logging(app)
    db.init_app(app)
    register_middleware(app)
    register_error_handlers(app)
    register_blueprints(app)

    with app.app_context():
        db.create_all()

    return app
