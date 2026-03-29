import jwt
import pytest
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
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": 9999,
        }
    )
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_header(app):
    token = jwt.encode(
        {
            "sub": "user-1",
            "email": "user@example.com",
            "name": "Atlas User",
            "roles": ["user"],
            "iss": app.config["JWT_ISSUER"],
            "aud": app.config["JWT_AUDIENCE"],
        },
        app.config["JWT_SECRET"],
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
