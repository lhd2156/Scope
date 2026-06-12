from __future__ import annotations

import signal
import socket
from types import SimpleNamespace
from urllib.parse import urlparse

import pytest
import urllib3
from marshmallow import ValidationError

from app.api.place_photos import PlacePhotoQuerySchema
from app.api.place_verification import PlaceVerificationRequestSchema
from app.kafka import consumer_worker, producer as producer_module
from app.ml import device
from app.ml.inference import tagger
from app.services.travel_nearby_service import TravelNearbyService


def test_device_detection_cpu_cuda_and_unavailable(monkeypatch):
    class FakeCuda:
        def __init__(self, available):
            self.available = available

        def is_available(self):
            return self.available

        def get_device_name(self, index):
            return "Fake GPU"

        def get_device_properties(self, index):
            return SimpleNamespace(total_mem=8 * 1024**3)

    class FakeTorch:
        __version__ = "test"
        version = SimpleNamespace(cuda="12.0")

        def __init__(self, available):
            self.cuda = FakeCuda(available)

        def device(self, name):
            return name

    device._device = None
    monkeypatch.setattr(device, "_load_torch", lambda: FakeTorch(False))
    assert device.get_device() == "cpu"
    assert device.device_info()["device"] == "cpu"

    device._device = None
    monkeypatch.setattr(device, "_load_torch", lambda: FakeTorch(True))
    info = device.device_info()
    assert info["device"] == "cuda"
    assert info["gpu_name"] == "Fake GPU"
    assert info["gpu_memory_gb"] == 8.0

    device._device = None
    monkeypatch.setattr(device, "_load_torch", lambda: (_ for _ in ()).throw(RuntimeError("missing")))
    assert device.device_info()["device"] == "unavailable"


def test_tagger_url_validation_redirect_limits_and_size_guards(monkeypatch):
    assert tagger._validate_public_image_url("https://8.8.8.8/image.png") == "https://8.8.8.8/image.png"
    with pytest.raises(ValueError):
        tagger._validate_public_image_url("ftp://8.8.8.8/image.png")
    with pytest.raises(ValueError):
        tagger._validate_public_image_url("https://user:pass@8.8.8.8/image.png")
    with pytest.raises(ValueError):
        tagger._validate_public_image_url("https://127.0.0.1/image.png")

    class LimitedResponse:
        headers = {"Content-Length": "5"}

        def iter_content(self, chunk_size):
            yield b"abc"
            yield b"def"

    with pytest.raises(ValueError):
        tagger._read_limited_response(LimitedResponse(), max_bytes=4)

    class EmptyRedirect:
        status = 302
        headers = {}

        def close(self):
            pass

    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: EmptyRedirect())
    with pytest.raises(ValueError, match="redirect"):
        tagger.classify_from_url("https://8.8.8.8/image.png")


def test_tagger_fetcher_rejects_bad_response_and_network_edges(monkeypatch):
    monkeypatch.setattr(
        tagger.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("93.184.216.34", 443))],
    )

    class ClosingResponse:
        def __init__(self, status=200, headers=None):
            self.status = status
            self.headers = headers or {}
            self.closed = False

        def iter_content(self, chunk_size):
            yield b"image"

        def close(self):
            self.closed = True

    response = ClosingResponse(status=503)
    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: response)
    with pytest.raises(ValueError, match="error status"):
        tagger.classify_from_url("https://example.com/image.png")
    assert response.closed is True

    response = ClosingResponse(headers={"Content-Type": "text/html; charset=utf-8"})
    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: response)
    with pytest.raises(ValueError, match="content type"):
        tagger.classify_from_url("https://example.com/image.png")
    assert response.closed is True

    monkeypatch.setattr(
        tagger,
        "_open_public_image_url",
        lambda url, timeout_seconds: (_ for _ in ()).throw(urllib3.exceptions.HTTPError("boom")),
    )
    with pytest.raises(ValueError, match="Unable to fetch"):
        tagger.classify_from_url("https://example.com/image.png")

    def fail_dns(*args, **kwargs):
        raise socket.gaierror("missing")

    monkeypatch.setattr(tagger.socket, "getaddrinfo", fail_dns)
    with pytest.raises(ValueError, match="could not be resolved"):
        tagger._validate_public_image_url("https://missing.example/image.png")


def test_tagger_pinned_fetcher_helpers_and_stream_limits(monkeypatch):
    monkeypatch.setattr(
        tagger.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("93.184.216.34", 443))],
    )
    assert tagger._request_target(urlparse("https://example.com")) == "/"
    assert tagger._request_target(urlparse("https://example.com/path?q=1")) == "/path?q=1"
    assert tagger._host_header(urlparse("https://[2001:4860:4860::8888]:8443/path")) == "[2001:4860:4860::8888]:8443"

    class RawResponse:
        status = 200
        headers = {"Content-Type": "image/png"}

        def __init__(self):
            self.released = False

        def stream(self, chunk_size, decode_content=False):
            assert decode_content is False
            yield b"a"
            yield b"b"

        def release_conn(self):
            self.released = True

    class RecordingPool:
        instances = []

        def __init__(self, address, **kwargs):
            self.address = address
            self.kwargs = kwargs
            self.closed = False
            self.urlopen_calls = []
            self.response = RawResponse()
            RecordingPool.instances.append(self)

        def urlopen(self, method, target, headers, preload_content, redirect):
            self.urlopen_calls.append((method, target, headers, preload_content, redirect))
            return self.response

        def close(self):
            self.closed = True

    monkeypatch.setattr(urllib3, "HTTPSConnectionPool", RecordingPool)
    wrapped = tagger._open_public_image_url("https://example.com:8443/path?q=1", timeout_seconds=1)
    assert list(wrapped.iter_content(1)) == [b"a", b"b"]
    wrapped.close()
    https_pool = RecordingPool.instances[-1]
    assert https_pool.address == "93.184.216.34"
    assert https_pool.kwargs["port"] == 8443
    assert https_pool.urlopen_calls[0][1] == "/path?q=1"
    assert https_pool.urlopen_calls[0][2]["Host"] == "example.com:8443"
    assert https_pool.response.released is True
    assert https_pool.closed is True

    monkeypatch.setattr(urllib3, "HTTPConnectionPool", RecordingPool)
    wrapped = tagger._open_public_image_url("http://example.com/plain", timeout_seconds=2)
    wrapped.close()
    http_pool = RecordingPool.instances[-1]
    assert http_pool.kwargs["port"] == 80
    assert http_pool.urlopen_calls[0][1] == "/plain"

    class FailingPool(RecordingPool):
        def urlopen(self, *args, **kwargs):
            raise RuntimeError("connect failed")

    monkeypatch.setattr(urllib3, "HTTPConnectionPool", FailingPool)
    with pytest.raises(RuntimeError, match="connect failed"):
        tagger._open_public_image_url("http://example.com/plain", timeout_seconds=2)
    assert FailingPool.instances[-1].closed is True

    class ChunkedNoLengthResponse:
        headers = {}

        def iter_content(self, chunk_size):
            yield b""
            yield b"abc"
            yield b"def"

    with pytest.raises(ValueError, match="too large"):
        tagger._read_limited_response(ChunkedNoLengthResponse(), max_bytes=4)


def test_kafka_worker_and_producer_edges(monkeypatch):
    class FakeApp:
        def app_context(self):
            return self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

    class FakeConsumer:
        def __init__(self):
            self.stopped = False
            self.ran = False

        def stop(self):
            self.stopped = True

        def run_forever(self):
            self.ran = True

    fake_consumer = FakeConsumer()
    handlers = {}
    monkeypatch.setattr(consumer_worker, "create_app", lambda: FakeApp())
    monkeypatch.setattr(consumer_worker, "KafkaSpotFeatureConsumer", lambda: fake_consumer)
    monkeypatch.setattr(consumer_worker.signal, "signal", lambda sig, handler: handlers.setdefault(sig, handler))

    consumer_worker.main()

    assert fake_consumer.ran is True
    handlers[signal.SIGTERM](signal.SIGTERM, None)
    assert fake_consumer.stopped is True

    class FakeProducer:
        def __init__(self, config):
            self.config = config
            self.produced = []
            self.flushed = False

        def produce(self, topic, payload):
            self.produced.append((topic, payload))

        def flush(self):
            self.flushed = True

    monkeypatch.setattr(producer_module, "Producer", FakeProducer)
    producer = producer_module.KafkaEventProducer()
    producer.publish("topic", {"x": 1})
    assert producer._producer.produced == [("topic", b'{"x": 1}')]
    assert producer._producer.flushed is True


def test_place_api_schemas_validate_boundaries_and_routes(client, auth_header, monkeypatch):
    verify_schema = PlaceVerificationRequestSchema()
    assert verify_schema.load({"title": " Place ", "latitude": 1, "longitude": 2})["address"] == ""
    with pytest.raises(ValidationError):
        verify_schema.load({"title": " ", "latitude": 1, "longitude": 2})
    with pytest.raises(ValidationError):
        verify_schema.load({"title": "x", "latitude": 91, "longitude": 2})
    with pytest.raises(ValidationError):
        verify_schema.load({"title": "x", "latitude": 1, "longitude": 181})

    photo_schema = PlacePhotoQuerySchema()
    assert photo_schema.load({"q": "Cafe", "lat": 1, "lng": 2})["maxWidthPx"] == 640
    for payload in [
        {"q": "", "lat": 1, "lng": 2},
        {"q": "Cafe", "lat": -91, "lng": 2},
        {"q": "Cafe", "lat": 1, "lng": 181},
        {"q": "Cafe", "lat": 1, "lng": 2, "maxWidthPx": 99999},
    ]:
        with pytest.raises(ValidationError):
            photo_schema.load(payload)

    monkeypatch.setattr("app.api.place_verification.service.verify", lambda payload: {"verified": True, "title": payload["title"]})
    monkeypatch.setattr("app.api.place_photos.service.get_featured_photo", lambda **kwargs: {"photoUrl": "https://photo", **kwargs})
    assert client.post("/api/intel/place/verify", headers=auth_header, json={"title": "Cafe", "latitude": 1, "longitude": 2}).get_json()["data"]["verified"] is True
    assert client.get("/api/intel/place-photo?q=Cafe&lat=1&lng=2", headers=auth_header).get_json()["data"]["photoUrl"] == "https://photo"


def test_travel_nearby_remaining_helper_edges(app, monkeypatch):
    service = TravelNearbyService(content_client=SimpleNamespace(nearby_spots=lambda *args, **kwargs: []))
    anchor = {"id": "a", "placeLabel": "A", "latitude": 1.0, "longitude": 2.0}
    context = {"interests": set(), "latest_intent": "", "budget_ceiling": 50, "pace": "relaxed", "fuel_type": "diesel", "radiusKm": 1}

    with app.app_context():
        app.config["GOOGLE_PLACES_API_KEY"] = "key"
        app.config["GOOGLE_PLACES_CACHE_SECONDS"] = 1
        monkeypatch.setattr(service._usage_guard, "consume", lambda bucket, cap: {"allowed": True, "cap": cap})
        monkeypatch.setattr("app.services.travel_nearby_service.requests.post", lambda *args, **kwargs: SimpleNamespace(raise_for_status=lambda: None, json=lambda: (_ for _ in ()).throw(ValueError("bad"))))
        assert "unreadable" in service._load_google_places(anchor, "fuel", 2, "diesel")["messages"][0]

        assert service._normalize_google_fuel_price({"price": {"units": "bad"}}) is None
        assert service._normalize_google_fuel_price({"price": {"units": "0"}}) is None
        assert service._format_price(2.5, "EUR") == "2.50 EUR/unit"
        assert service._price_level_label("PRICE_LEVEL_FREE") == "Free"
        assert service._price_level_label("PRICE_LEVEL_INEXPENSIVE") == "$"
        assert service._price_level_label("PRICE_LEVEL_EXPENSIVE") == "$$$"
        assert service._first_photo({"photos": ["bad"]}) is None
        assert service._first_photo_attribution({"authorAttributions": ["bad"]}) == {"displayName": None, "uri": None}
        assert service._slug("!!!") == "place"

        no_price = service._extract_fuel_price({"fuelOptions": {"fuelPrices": "bad"}}, "ev")
        assert no_price == (None, "", "ev")
        missing_selected = service._extract_fuel_price(
            {"fuelOptions": {"fuelPrices": [{"type": "REGULAR_UNLEADED", "price": {"units": 3, "nanos": 0}}]}},
            "diesel",
        )
        assert missing_selected == (None, "", "diesel")

        place = {
            "id": "",
            "displayName": {"text": "Mystery View"},
            "formattedAddress": "",
            "location": {"latitude": 1, "longitude": 2},
            "primaryType": "tourist_attraction",
            "types": ["tourist_attraction"],
            "priceLevel": "PRICE_LEVEL_FREE",
        }
        normalized = service._normalize_google_place(place, anchor, "recommended", context)
        assert normalized["id"] == "google-mystery-view"
        assert normalized["category"] == "scenic"
