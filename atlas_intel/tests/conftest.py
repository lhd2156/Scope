from pathlib import Path
import sys

import jwt
import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app import create_app
from app.rate_limit import reset_rate_limit_state

TEST_SECRET_KEY = "atlas-intel-test-secret"
TEST_JWT_SECRET = "atlas-intel-test-jwt-secret"
TEST_JWT_ISSUER = "atlas-core"
TEST_JWT_AUDIENCE = "atlas-frontend"


@pytest.fixture(autouse=True)
def rate_limit_state():
    reset_rate_limit_state()
    yield
    reset_rate_limit_state()


@pytest.fixture()
def app():
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": TEST_SECRET_KEY,
            "JWT_SECRET": TEST_JWT_SECRET,
            "JWT_ISSUER": TEST_JWT_ISSUER,
            "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
            "FRONTEND_ORIGIN": "https://atlas-frontend.example",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": 9999,
            "ML_REQUEST_TIMEOUT_SECONDS": 5.0,
        }
    )
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


def _auth_header_for_subject(app, subject: str, email: str, name: str):
    token = jwt.encode(
        {
            "sub": subject,
            "email": email,
            "name": name,
            "roles": ["user"],
            "iss": app.config["JWT_ISSUER"],
            "aud": app.config["JWT_AUDIENCE"],
        },
        app.config["JWT_SECRET"],
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_header(app):
    return _auth_header_for_subject(app, "user-1", "user@example.com", "Atlas User")


@pytest.fixture()
def second_auth_header(app):
    return _auth_header_for_subject(app, "user-2", "second@example.com", "Second User")
