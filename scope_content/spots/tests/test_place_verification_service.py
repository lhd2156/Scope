from __future__ import annotations

from types import SimpleNamespace

import requests

from spots.services import place_verification


def test_intel_base_url_uses_env_priority_and_strips_slash(monkeypatch):
    monkeypatch.setenv("CONTENT_INTEL_URL", "http://content-intel/")
    assert place_verification._intel_base_url() == "http://content-intel"

    monkeypatch.setenv("SCOPE_INTEL_URL", "http://scope-intel/")
    assert place_verification._intel_base_url() == "http://scope-intel"

    monkeypatch.setenv("INTEL_SERVICE_URL", "http://intel-service/")
    assert place_verification._intel_base_url() == "http://intel-service"


def test_verify_spot_place_success_unwrapped_and_wrapped(monkeypatch):
    calls = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers, timeout))
        return FakeResponse({"data": {"verified": True, "source": "google"}})

    monkeypatch.setenv("INTEL_SERVICE_URL", "http://intel")
    monkeypatch.setattr(place_verification.requests, "post", fake_post)

    assert place_verification.verify_spot_place({"name": "A"}, "Bearer token") == {"verified": True, "source": "google"}
    assert calls[0][0] == "http://intel/api/intel/place/verify"
    assert calls[0][2]["Authorization"] == "Bearer token"
    assert calls[0][3] == place_verification.VERIFY_TIMEOUT_SECONDS

    monkeypatch.setattr(place_verification.requests, "post", lambda *args, **kwargs: FakeResponse({"verified": False, "reason": "too far"}))
    assert place_verification.verify_spot_place({"name": "B"})["reason"] == "too far"


def test_verify_spot_place_handles_transport_json_and_unreadable_responses(monkeypatch):
    monkeypatch.setattr(place_verification.requests, "post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
    unavailable = place_verification.verify_spot_place({"name": "A"})
    assert unavailable["verified"] is False
    assert "unavailable" in unavailable["reason"]

    class BadJson:
        def raise_for_status(self):
            return None

        def json(self):
            raise ValueError("bad json")

    monkeypatch.setattr(place_verification.requests, "post", lambda *args, **kwargs: BadJson())
    assert "unavailable" in place_verification.verify_spot_place({"name": "A"})["reason"]

    monkeypatch.setattr(
        place_verification.requests,
        "post",
        lambda *args, **kwargs: SimpleNamespace(raise_for_status=lambda: None, json=lambda: ["not", "dict"]),
    )
    unreadable = place_verification.verify_spot_place({"name": "A"})
    assert unreadable["verified"] is False
    assert "unreadable" in unreadable["reason"]
