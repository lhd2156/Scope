from __future__ import annotations

import importlib
import json
import sys
import types
from types import SimpleNamespace

import grpc
import pytest

from app.kafka import consumer as consumer_module
from app.services.content_client import Spot

TEST_GRPC_INTERNAL_TOKEN = "intel-grpc-test-token-0000000000000000000000000"


class FakeConsumer:
    def __init__(self, config):
        self.config = config
        self.closed = False
        self.commits = []
        self.messages = []

    def subscribe(self, topics):
        self.topics = topics

    def poll(self, timeout):
        return self.messages.pop(0) if self.messages else None

    def commit(self, message, asynchronous=False):
        self.commits.append((message.topic(), asynchronous))

    def close(self):
        self.closed = True


class FakeMessage:
    def __init__(self, topic="spot.created", value=b"{}", error=None):
        self._topic = topic
        self._value = value
        self._error = error

    def topic(self):
        return self._topic

    def value(self):
        return self._value

    def error(self):
        return self._error


def test_kafka_run_forever_handles_poll_errors_bad_payload_commit_and_stop(monkeypatch):
    fake_consumer = FakeConsumer({})
    fake_consumer.messages = [
        None,
        FakeMessage(error="partition eof"),
        FakeMessage(value=b"{not json"),
        FakeMessage(topic="spot.updated", value=json.dumps({"spotId": "spot-1"}).encode("utf-8")),
    ]
    monkeypatch.setattr(consumer_module, "Consumer", lambda config: fake_consumer)
    consumer = consumer_module.KafkaSpotFeatureConsumer()
    handled = []

    def fake_handle_event(topic, envelope):
        handled.append((topic, envelope))
        consumer.stop()

    monkeypatch.setattr(consumer, "handle_event", fake_handle_event)

    consumer.run_forever()

    assert handled == [("spot.updated", {"spotId": "spot-1"})]
    assert fake_consumer.commits == [("spot.updated", False)]
    assert fake_consumer.closed is True


def test_kafka_helpers_event_shapes_and_spot_hydration(app, monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    consumer = consumer_module.KafkaSpotFeatureConsumer()
    messages = []
    monkeypatch.setattr(consumer, "handle_message", lambda topic, payload, event_id=None: messages.append((topic, payload, event_id)))

    consumer.handle_event("topic", ["not dict"])
    consumer.handle_event("topic", {"eventId": "evt-1", "data": ["bad"]})
    consumer.handle_event("topic", {"data": {"spotId": "spot-1", "eventId": "payload-event"}})

    assert messages == [
        ("topic", {}, None),
        ("topic", {}, "evt-1"),
        ("topic", {"spotId": "spot-1", "eventId": "payload-event"}, "payload-event"),
    ]

    assert consumer_module._parse_iso_datetime("bad") is None
    assert consumer_module._payload_spot_id({"spot_id": "s"}) == "s"
    assert consumer_module._payload_float({"x": "bad"}, "x", 2.5) == 2.5
    assert consumer_module._payload_int({"x": "bad"}, "x", 3) == 3

    hydrated = Spot("hydrated", "Hydrated", "", "food", "", 4.0, 10, 20, 1, 2, False, 1, ())

    class FakeContentClient:
        def get_spot(self, spot_id):
            return hydrated

    monkeypatch.setattr(consumer_module, "ContentServiceClient", FakeContentClient)
    with app.app_context():
        assert consumer_module._spot_from_payload_or_content({"spotId": "hydrated"}) is hydrated

    class BrokenContentClient:
        def get_spot(self, spot_id):
            raise RuntimeError("offline")

    monkeypatch.setattr(consumer_module, "ContentServiceClient", BrokenContentClient)
    with app.app_context():
        fallback = consumer_module._spot_from_payload_or_content({"spotId": "fallback", "likedByUsers": None})
    assert fallback.spot_id == "fallback"
    assert fallback.liked_by_users == ()


def test_kafka_missing_friend_and_interaction_fields_do_not_call_repository(monkeypatch):
    monkeypatch.setattr(consumer_module, "Consumer", FakeConsumer)
    consumer = consumer_module.KafkaSpotFeatureConsumer()
    monkeypatch.setattr(consumer_module.IntelRepository, "record_friend_edge", lambda *args: (_ for _ in ()).throw(AssertionError("no friend edge")))
    monkeypatch.setattr(consumer_module.IntelRepository, "remove_friend_edge", lambda *args: (_ for _ in ()).throw(AssertionError("no remove edge")))
    monkeypatch.setattr(consumer_module.IntelRepository, "record_interaction", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("no interaction")))

    consumer.handle_message("friend.accepted", {})
    consumer.handle_message("friend.removed", {})
    consumer.handle_message("interaction.recorded", {"userId": "user-only"})


def _install_fake_grpc_proto_modules(monkeypatch):
    scope_module = types.ModuleType("scope")
    v1_module = types.ModuleType("scope.v1")
    intel_pb2 = types.ModuleType("scope.v1.intel_pb2")
    intel_pb2_grpc = types.ModuleType("scope.v1.intel_pb2_grpc")

    class Message:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        def __eq__(self, other):
            return type(self) is type(other) and self.__dict__ == other.__dict__

    for name in [
        "SentimentResponse",
        "SentimentBatchResponse",
        "ClassifyImageResponse",
        "ImageTag",
        "PredictTripResponse",
        "RecommendationResponse",
        "RecommendedSpot",
    ]:
        setattr(intel_pb2, name, type(name, (Message,), {}))

    intel_pb2.DESCRIPTOR = SimpleNamespace(services_by_name={"IntelService": SimpleNamespace(full_name="scope.v1.IntelService")})
    intel_pb2_grpc.IntelServiceServicer = object
    intel_pb2_grpc.add_IntelServiceServicer_to_server = lambda servicer, server: server.calls.append(("intel", servicer))

    monkeypatch.setitem(sys.modules, "scope", scope_module)
    monkeypatch.setitem(sys.modules, "scope.v1", v1_module)
    monkeypatch.setitem(sys.modules, "scope.v1.intel_pb2", intel_pb2)
    monkeypatch.setitem(sys.modules, "scope.v1.intel_pb2_grpc", intel_pb2_grpc)
    return intel_pb2


def test_grpc_services_methods_with_fake_proto(monkeypatch):
    intel_pb2 = _install_fake_grpc_proto_modules(monkeypatch)
    sys.modules.pop("app.grpc_services", None)
    grpc_services = importlib.import_module("app.grpc_services")
    service = grpc_services.IntelServiceServicer()

    monkeypatch.setattr("app.ml.inference.sentiment.analyze_sentiment", lambda text: {"label": "POSITIVE", "score": 0.9, "normalized_score": 0.9})
    monkeypatch.setattr("app.ml.inference.sentiment.analyze_batch", lambda texts: [{"label": "NEGATIVE", "score": 0.8, "normalized_score": -0.8} for _ in texts])
    monkeypatch.setattr("app.ml.inference.tagger.classify_from_url", lambda url, top_k: [{"tag": "beach", "confidence": 0.7}])
    monkeypatch.setattr("app.ml.inference.tagger.classify_image", lambda data, top_k: [{"tag": "park", "confidence": 0.6}])
    monkeypatch.setattr("app.ml.inference.predictor.predict_trip", lambda features: {"predicted_days": 2, "predicted_cost_usd": 300, "confidence": 0.75, "source": "test"})
    monkeypatch.setattr("app.ml.inference.recommender.recommend_spots", lambda user_id, limit: [{"spot_id": "spot-1", "score": 0.9, "source": "ncf"}])

    sentiment = service.AnalyzeSentiment(SimpleNamespace(text="great", review_id="review-1"), None)
    assert sentiment.label == "POSITIVE"
    assert service.AnalyzeSentimentBatch(SimpleNamespace(texts=["bad"]), None).results[0].label == "NEGATIVE"
    assert service.ClassifyImage(SimpleNamespace(url="https://image", image_data=b"", top_k=1, photo_id="p"), None).tags[0].tag == "beach"
    assert service.ClassifyImage(SimpleNamespace(url="", image_data=b"raw", top_k=1, photo_id="p"), None).tags[0].tag == "park"

    class FakeContext:
        def __init__(self):
            self.code = None
            self.details = None

        def set_code(self, code):
            self.code = code

        def set_details(self, details):
            self.details = details

    context = FakeContext()
    assert service.ClassifyImage(SimpleNamespace(url="", image_data=b"", top_k=0, photo_id="p"), context) == intel_pb2.ClassifyImageResponse()
    assert context.code == grpc.StatusCode.INVALID_ARGUMENT

    prediction = service.PredictTrip(
        SimpleNamespace(num_spots=3, total_distance_km=100, avg_rating=4, num_outdoor=1, num_food=1, num_cultural=1, month=6),
        None,
    )
    assert prediction.source == "test"
    assert service.GetRecommendations(SimpleNamespace(user_id="user-1", limit=1), None).spots[0].spot_id == "spot-1"


def test_grpc_server_startup_paths_with_fake_proto(monkeypatch):
    _install_fake_grpc_proto_modules(monkeypatch)
    sys.modules.pop("app.grpc_services", None)
    sys.modules.pop("app.grpc_server", None)
    grpc_server = importlib.import_module("app.grpc_server")
    grpc_server._server = None
    grpc_server._thread = None
    monkeypatch.setenv("GRPC_INTERNAL_TOKEN", TEST_GRPC_INTERNAL_TOKEN)
    monkeypatch.setenv("GRPC_ENABLE_REFLECTION", "true")

    class FakeServer:
        def __init__(self, bound_port=grpc_server.GRPC_PORT):
            self.bound_port = bound_port
            self.calls = []
            self.started = False
            self.waited = False

        def add_generic_rpc_handlers(self, handlers):
            self.calls.append(("handlers", len(handlers)))

        def add_registered_method_handlers(self, service_name, handlers):
            self.calls.append(("registered", service_name))

        def add_insecure_port(self, address):
            return self.bound_port

        def start(self):
            self.started = True

        def wait_for_termination(self):
            self.waited = True

    server = FakeServer()
    monkeypatch.setattr(grpc_server.grpc, "server", lambda executor, **_kwargs: server)
    monkeypatch.setattr(grpc_server.reflection, "enable_server_reflection", lambda names, current_server: current_server.calls.append(("reflection", tuple(names))))
    assert grpc_server.serve_grpc() is server
    assert server.started is True
    assert any(call[0] == "reflection" for call in server.calls)
    assert grpc_server.serve_grpc() is server

    grpc_server._server = None
    monkeypatch.setattr(grpc_server.grpc, "server", lambda executor, **_kwargs: FakeServer(bound_port=0))
    assert grpc_server.serve_grpc() is None

    class FakeThread:
        def __init__(self, target, name, daemon):
            self.target = target
            self.name = name
            self.daemon = daemon
            self.started = False

        def is_alive(self):
            return False

        def start(self):
            self.started = True

    monkeypatch.setattr(grpc_server.threading, "Thread", FakeThread)
    created = grpc_server.start_grpc_background()
    assert created.name == "intel-grpc"
    assert created.daemon is True
    assert created.started is True

    waited_server = FakeServer()
    monkeypatch.setattr(grpc_server, "serve_grpc", lambda: waited_server)
    grpc_server._run_grpc()
    assert waited_server.waited is True

    monkeypatch.setattr(grpc_server, "serve_grpc", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    grpc_server._run_grpc()

    monkeypatch.setattr(grpc_server, "serve_grpc", lambda: None)
    grpc_server._run_grpc()


def test_grpc_auth_interceptor_rejects_missing_token_and_accepts_internal_token(monkeypatch):
    sys.modules.pop("app.grpc_server", None)
    grpc_server = importlib.import_module("app.grpc_server")
    interceptor = grpc_server.InternalGrpcAuthInterceptor(TEST_GRPC_INTERNAL_TOKEN)
    handler = grpc.unary_unary_rpc_method_handler(lambda request, context: "ok")

    def continuation(_details):
        return handler

    rejected = interceptor.intercept_service(
        continuation,
        SimpleNamespace(method="/scope.v1.IntelService/GetRecommendations", invocation_metadata=[]),
    )

    class AbortContext:
        def abort(self, code, details):
            raise RuntimeError(f"{code.name}:{details}")

    with pytest.raises(RuntimeError, match="UNAUTHENTICATED"):
        rejected.unary_unary(object(), AbortContext())

    accepted = interceptor.intercept_service(
        continuation,
        SimpleNamespace(
            method="/scope.v1.IntelService/GetRecommendations",
            invocation_metadata=[("authorization", f"Bearer {TEST_GRPC_INTERNAL_TOKEN}")],
        ),
    )
    assert accepted.unary_unary(object(), object()) == "ok"

    health_handler = interceptor.intercept_service(
        continuation,
        SimpleNamespace(method="/grpc.health.v1.Health/Check", invocation_metadata=[]),
    )
    assert health_handler is handler

    assert grpc_server._metadata_has_valid_token(
        [("x-scope-internal-token", TEST_GRPC_INTERNAL_TOKEN)],
        TEST_GRPC_INTERNAL_TOKEN,
    )
    assert not grpc_server._metadata_has_valid_token([("authorization", "Basic nope")], TEST_GRPC_INTERNAL_TOKEN)
    assert not grpc_server._metadata_has_valid_token(None, TEST_GRPC_INTERNAL_TOKEN)

    handler_cases = [
        (
            grpc.unary_stream_rpc_method_handler(lambda _request, _context: iter(["ok"])),
            lambda rejected_handler: list(rejected_handler.unary_stream(object(), AbortContext())),
        ),
        (
            grpc.stream_unary_rpc_method_handler(lambda _request_iterator, _context: "ok"),
            lambda rejected_handler: rejected_handler.stream_unary(iter([object()]), AbortContext()),
        ),
        (
            grpc.stream_stream_rpc_method_handler(lambda _request_iterator, _context: iter(["ok"])),
            lambda rejected_handler: list(rejected_handler.stream_stream(iter([object()]), AbortContext())),
        ),
    ]
    for current_handler, invoke in handler_cases:
        rejected_handler = interceptor.intercept_service(
            lambda _details, selected=current_handler: selected,
            SimpleNamespace(method="/scope.v1.IntelService/GetRecommendations", invocation_metadata=[]),
        )
        with pytest.raises(RuntimeError, match="UNAUTHENTICATED"):
            invoke(rejected_handler)

    empty_handler = SimpleNamespace(unary_unary=None, unary_stream=None, stream_unary=None, stream_stream=None)
    assert grpc_server._unauthenticated_handler(empty_handler) is empty_handler


def test_grpc_ensure_proto_path_adds_missing_path(monkeypatch):
    sys.modules.pop("app.grpc_server", None)
    grpc_server = importlib.import_module("app.grpc_server")
    proto_path = str(grpc_server.Path(grpc_server.__file__).resolve().parent / "proto")
    monkeypatch.setattr(sys, "path", [entry for entry in sys.path if entry != proto_path])

    grpc_server._ensure_proto_path()

    assert sys.path[0] == proto_path


def test_grpc_requires_internal_token_before_starting(monkeypatch):
    sys.modules.pop("app.grpc_server", None)
    grpc_server = importlib.import_module("app.grpc_server")
    monkeypatch.delenv("GRPC_INTERNAL_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="GRPC_INTERNAL_TOKEN"):
        grpc_server._require_internal_token()
