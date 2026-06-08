from app.services import google_places_usage_guard as usage_module
from app.services.google_places_usage_guard import GooglePlacesUsageGuard


class _FakeRedis:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def eval(self, *args):
        self.calls.append(args)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def test_redis_usage_ledger_allows_and_counts_atomically(app, monkeypatch):
    client = _FakeRedis([1, 3])
    monkeypatch.setattr(usage_module, "_redis_client_for", lambda _url: client)
    app.config["GOOGLE_PLACES_USAGE_REDIS_URL"] = "redis://usage.test/6"

    with app.app_context():
        result = GooglePlacesUsageGuard().consume("places_text_search_pro", 10, units=2)

    assert result == {
        "allowed": True,
        "sku": "places_text_search_pro",
        "used": 3,
        "cap": 10,
        "remaining": 7,
    }
    assert GooglePlacesUsageGuard._current_month() in client.calls[0][2]
    assert client.calls[0][3:] == (2, 10, usage_module._REDIS_TTL_SECONDS)


def test_redis_usage_ledger_fails_closed_when_cap_reached(app, monkeypatch):
    client = _FakeRedis([0, 10])
    monkeypatch.setattr(usage_module, "_redis_client_for", lambda _url: client)
    app.config["GOOGLE_PLACES_USAGE_REDIS_URL"] = "redis://usage.test/6"

    with app.app_context():
        result = GooglePlacesUsageGuard().consume("places_text_search_pro", 10)

    assert result["allowed"] is False
    assert result["used"] == 10
    assert result["remaining"] == 0


def test_usage_ledger_fails_closed_when_redis_is_unavailable(app, monkeypatch):
    client = _FakeRedis(ConnectionError("offline"))
    monkeypatch.setattr(usage_module, "_redis_client_for", lambda _url: client)
    app.config["GOOGLE_PLACES_USAGE_REDIS_URL"] = "redis://usage.test/6"

    with app.app_context():
        result = GooglePlacesUsageGuard().consume("places_text_search_pro", 10)

    assert result["allowed"] is False
    assert result["reason"] == "usage_store_unavailable"


def test_file_usage_ledger_fails_closed_when_path_is_read_only(app, monkeypatch, tmp_path):
    guard = GooglePlacesUsageGuard()
    app.config["GOOGLE_PLACES_USAGE_REDIS_URL"] = ""
    app.config["GOOGLE_PLACES_USAGE_FILE"] = str(tmp_path / "usage.json")
    monkeypatch.setattr(guard, "_write_usage", lambda _payload: (_ for _ in ()).throw(OSError("read-only")))

    with app.app_context():
        result = guard.consume("places_text_search_pro", 10)

    assert result["allowed"] is False
    assert result["reason"] == "usage_store_unavailable"
