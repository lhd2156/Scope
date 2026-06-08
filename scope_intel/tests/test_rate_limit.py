import jwt
from types import SimpleNamespace
from unittest.mock import Mock

from app import create_app
from app import client_ip as client_ip_module
from app import rate_limit as rate_limit_module

TEST_SECRET_KEY = "scope-intel-test-secret"
TEST_JWT_SECRET = "scope-intel-test-jwt-secret-at-least-32-bytes"
TEST_JWT_ISSUER = "scope-core"
TEST_JWT_AUDIENCE = "scope-frontend"


def build_app(rate_limit_per_minute: int = 2, extra_config: dict | None = None):
    config = {
        "TESTING": True,
        "SECRET_KEY": TEST_SECRET_KEY,
        "JWT_SECRET": TEST_JWT_SECRET,
        "JWT_ISSUER": TEST_JWT_ISSUER,
        "JWT_AUDIENCE": TEST_JWT_AUDIENCE,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATE_LIMIT_PER_MINUTE": rate_limit_per_minute,
        "FUEL_RATE_LIMIT_PER_MINUTE": rate_limit_per_minute,
        "RATELIMIT_ENABLED": True,
    }
    if extra_config:
        config.update(extra_config)
    return create_app(config)


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


def test_fuel_endpoint_uses_fuel_specific_rate_limit():
    app = build_app(rate_limit_per_minute=1)
    app.config["GOOGLE_PLACES_API_KEY"] = ""
    client = app.test_client()

    first_response = client.get("/api/intel/fuel/stations", query_string={"lat": 52.52, "lng": 13.405})
    second_response = client.get("/api/intel/fuel/stations", query_string={"lat": 52.52, "lng": 13.405})

    assert first_response.status_code == 401
    assert second_response.status_code == 429
    assert second_response.get_json()["error"]["code"] == "RATE_LIMITED"


def test_rotating_invalid_bearer_tokens_cannot_bypass_ip_limit():
    client = build_app(rate_limit_per_minute=1).test_client()

    first_response = client.get(
        "/api/intel/health",
        headers={"Authorization": "Bearer invalid-token-one"},
    )
    second_response = client.get(
        "/api/intel/health",
        headers={"Authorization": "Bearer invalid-token-two"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 429


def test_multiple_valid_tokens_for_same_subject_share_user_limit():
    app = build_app(rate_limit_per_minute=1)
    client = app.test_client()

    def token(jti: str) -> str:
        return jwt.encode(
            {
                "sub": "same-user",
                "jti": jti,
                "iss": TEST_JWT_ISSUER,
                "aud": TEST_JWT_AUDIENCE,
            },
            TEST_JWT_SECRET,
            algorithm="HS256",
        )

    first_response = client.get(
        "/api/intel/health",
        headers={"Authorization": f"Bearer {token('one')}"},
    )
    second_response = client.get(
        "/api/intel/health",
        headers={"Authorization": f"Bearer {token('two')}"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 429


def test_forwarded_client_ip_is_used_only_for_trusted_proxy():
    trusted_app = build_app(
        rate_limit_per_minute=1,
        extra_config={"TRUSTED_PROXY_CIDRS": "172.16.0.0/12"},
    )
    trusted_client = trusted_app.test_client()
    trusted_remote = {"REMOTE_ADDR": "172.18.0.10"}

    first_client = trusted_client.get(
        "/api/intel/health",
        headers={"X-Forwarded-For": "198.51.100.10"},
        environ_overrides=trusted_remote,
    )
    second_client = trusted_client.get(
        "/api/intel/health",
        headers={"X-Forwarded-For": "198.51.100.11"},
        environ_overrides=trusted_remote,
    )
    repeated_first_client = trusted_client.get(
        "/api/intel/health",
        headers={"X-Forwarded-For": "198.51.100.10"},
        environ_overrides=trusted_remote,
    )

    assert first_client.status_code == 200
    assert second_client.status_code == 200
    assert repeated_first_client.status_code == 429

    rate_limit_module.reset_rate_limit_state()
    untrusted_app = build_app(
        rate_limit_per_minute=1,
        extra_config={"TRUSTED_PROXY_CIDRS": "172.16.0.0/12"},
    )
    untrusted_client = untrusted_app.test_client()
    untrusted_remote = {"REMOTE_ADDR": "203.0.113.50"}

    first_spoof = untrusted_client.get(
        "/api/intel/health",
        headers={"X-Forwarded-For": "198.51.100.20"},
        environ_overrides=untrusted_remote,
    )
    second_spoof = untrusted_client.get(
        "/api/intel/health",
        headers={"X-Forwarded-For": "198.51.100.21"},
        environ_overrides=untrusted_remote,
    )

    assert first_spoof.status_code == 200
    assert second_spoof.status_code == 429


def test_redis_counter_is_used_for_distributed_limit(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.counts = {}
            self.calls = 0

        def eval(self, _script, _number_of_keys, key, _window):
            self.calls += 1
            self.counts[key] = self.counts.get(key, 0) + 1
            return [self.counts[key], 60]

    fake_redis = FakeRedis()
    monkeypatch.setattr(rate_limit_module, "_redis_client", lambda: fake_redis)
    app = build_app(rate_limit_per_minute=1)

    with app.app_context():
        first_result = rate_limit_module._permit_redis("distributed-test", 1)
        second_result = rate_limit_module._permit_redis("distributed-test", 1)

    assert first_result == (True, 60)
    assert second_result == (False, 60)
    assert fake_redis.calls == 2
    assert not rate_limit_module._request_windows


def test_valid_token_without_subject_falls_back_to_client_ip():
    app = build_app(rate_limit_per_minute=1)
    client = app.test_client()
    token = jwt.encode(
        {
            "iss": TEST_JWT_ISSUER,
            "aud": TEST_JWT_AUDIENCE,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )

    first_response = client.get(
        "/api/intel/health",
        headers={"Authorization": f"Bearer {token}"},
    )
    second_response = client.get(
        "/api/intel/health",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 429


def test_malformed_forwarded_ip_and_proxy_config_are_ignored(monkeypatch):
    app = build_app(
        extra_config={
            "TRUSTED_PROXY_CIDRS": ["", "not-a-cidr", "172.16.0.0/12"],
        }
    )
    warning = Mock()
    monkeypatch.setattr(app.logger, "warning", warning)

    with app.test_request_context(
        "/",
        headers={"X-Forwarded-For": "not-an-ip"},
        environ_base={"REMOTE_ADDR": "172.18.0.10"},
    ):
        assert client_ip_module.get_client_ip() == "172.18.0.10"
        warning.assert_called_once_with(
            "Ignoring invalid Intel trusted proxy CIDR",
            extra={"cidr": "not-a-cidr"},
        )

    with app.test_request_context(
        "/",
        headers={"X-Forwarded-For": "198.51.100.20"},
        environ_base={"REMOTE_ADDR": "not-an-ip"},
    ):
        assert client_ip_module.get_client_ip() == "not-an-ip"


def test_redis_client_caches_connections_and_backs_off_after_init_failure(monkeypatch):
    import redis

    app = build_app(extra_config={"RATELIMIT_STORAGE_URI": "redis://shared/3"})
    fake_client = object()
    from_url_calls = []

    def fake_from_url(storage_uri, **options):
        from_url_calls.append((storage_uri, options))
        return fake_client

    monkeypatch.setattr(redis, "from_url", fake_from_url)
    real_time = rate_limit_module.time
    monkeypatch.setattr(
        rate_limit_module,
        "time",
        SimpleNamespace(monotonic=lambda: 100.0, time=real_time.time),
    )

    with app.app_context():
        assert rate_limit_module._redis_client() is fake_client
        assert rate_limit_module._redis_client() is fake_client

    assert len(from_url_calls) == 1
    assert from_url_calls[0][0] == "redis://shared/3"
    assert from_url_calls[0][1]["socket_connect_timeout"] == 1

    rate_limit_module.reset_rate_limit_state()
    monkeypatch.setattr(redis, "from_url", lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("down")))

    with app.app_context():
        assert rate_limit_module._redis_client() is None
        assert rate_limit_module._redis_client() is None
        assert rate_limit_module._redis_retry_after["redis://shared/3"] == 105.0


def test_non_redis_storage_and_redis_operation_failure_use_local_fallback(monkeypatch):
    memory_app = build_app(extra_config={"RATELIMIT_STORAGE_URI": "memory://"})
    with memory_app.app_context():
        assert rate_limit_module._redis_client() is None

    class FailingRedis:
        def eval(self, *_args, **_kwargs):
            raise TimeoutError("redis unavailable")

    monkeypatch.setattr(rate_limit_module, "_redis_client", lambda: FailingRedis())
    client = build_app(
        rate_limit_per_minute=1,
        extra_config={"RATELIMIT_STORAGE_URI": "redis://shared/3"},
    ).test_client()

    first_response = client.get("/api/intel/health")
    second_response = client.get("/api/intel/health")

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert rate_limit_module._redis_retry_after["redis://shared/3"] > 0


def test_local_window_expires_and_zero_limit_disables_bucket(monkeypatch):
    monkeypatch.setattr(rate_limit_module, "_redis_client", lambda: None)
    times = iter((100.0, 161.0))
    real_time = rate_limit_module.time
    monkeypatch.setattr(
        rate_limit_module,
        "time",
        SimpleNamespace(time=lambda: next(times), monotonic=real_time.monotonic),
    )

    assert rate_limit_module._permit_local("expiring-key", 1) == (True, 60)
    assert rate_limit_module._permit_local("expiring-key", 1) == (True, 60)

    monkeypatch.setattr(rate_limit_module, "time", real_time)
    client = build_app(rate_limit_per_minute=0).test_client()
    assert client.get("/api/intel/health").status_code == 200
    assert client.get("/api/intel/health").status_code == 200


def test_global_rate_limit_switch_disables_bucket():
    client = build_app(
        rate_limit_per_minute=1,
        extra_config={"RATELIMIT_ENABLED": False},
    ).test_client()

    assert client.get("/api/intel/health").status_code == 200
    assert client.get("/api/intel/health").status_code == 200
