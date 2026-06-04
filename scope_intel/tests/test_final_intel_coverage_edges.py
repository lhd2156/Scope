from __future__ import annotations

import signal
from types import SimpleNamespace

import pytest
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
