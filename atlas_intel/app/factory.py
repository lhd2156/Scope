from flask import Flask
from app.api import register_blueprints
from app.errors import register_error_handlers
from app.extensions import db
from app.logging_config import configure_logging
from app.middleware import register_middleware


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object("config.Settings")
    app.config["SECRET_KEY"] = __import__("config").settings.secret_key
    app.config["SQLALCHEMY_DATABASE_URI"] = __import__("config").settings.database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    configure_logging(app)
    db.init_app(app)
    register_middleware(app)
    register_error_handlers(app)
    register_blueprints(app)

    with app.app_context():
        db.create_all()

    return app
