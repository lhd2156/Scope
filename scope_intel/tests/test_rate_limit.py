from app import create_app

TEST_SECRET_KEY = "scope-intel-test-secret"
TEST_JWT_SECRET = "scope-intel-test-jwt-secret"
TEST_JWT_ISSUER = "scope-core"
TEST_JWT_AUDIENCE = "scope-frontend"


def build_app(rate_limit_per_minute: int = 2):
    return create_app(
        {
            "TESTING": True,
            "SECRET_KEY": TEST_SECRET_KEY,
            "JWT_SECRET": TEST_JWT_SECRET,
            "JWT_ISSUER": TEST_JWT_ISSUER,
            "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "RATE_LIMIT_PER_MINUTE": rate_limit_per_minute,
        }
    )


def test_all_intel_routes_are_rate_limited():
    app = build_app()

    route_rules = [rule for rule in app.url_map.iter_rules() if rule.rule.startswith("/api/intel")]
    assert route_rules

    for rule in route_rules:
        view_function = app.view_functions[rule.endpoint]
        assert getattr(view_function, "_scope_rate_limited", False), f"{rule.rule} is missing @rate_limited"


def test_rate_limit_returns_429_with_retry_after_header():
    app = build_app(rate_limit_per_minute=1)
    client = app.test_client()

    first_response = client.get("/api/intel/health")
    second_response = client.get("/api/intel/health")

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert second_response.headers["Retry-After"] == "60"
    assert second_response.get_json()["error"]["code"] == "RATE_LIMITED"
