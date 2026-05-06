import pytest
from app import create_app


def test_create_app_requires_secret_key_and_jwt_secret():
    with pytest.raises(RuntimeError, match="FLASK_SECRET_KEY, CORE_JWT_SECRET"):
        create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "",
                "JWT_SECRET": "",
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            }
        )
