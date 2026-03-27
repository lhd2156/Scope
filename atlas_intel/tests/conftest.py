import jwt
import pytest
from app import create_app


@pytest.fixture()
def app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "RATE_LIMIT_PER_MINUTE": 9999})
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_header():
    token = jwt.encode(
        {"sub": "user-1", "email": "user@example.com", "name": "Atlas User", "roles": ["user"], "iss": "atlas-core", "aud": "atlas-frontend"},
        "super-secret-256-bit-key-change-in-prod",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
