from __future__ import annotations

import sys
import uuid
from datetime import datetime
from types import SimpleNamespace

import grpc
import pytest
from django.utils import timezone

from common import grpc_server, grpc_services
from spots.models import Spot

from scope.v1 import common_pb2, spot_pb2

pytestmark = pytest.mark.django_db
TEST_GRPC_INTERNAL_TOKEN = "content-grpc-test-token-000000000000000000000000"


class FakeContext:
    def __init__(self):
        self.code = None
        self.details = None

    def set_code(self, code):
        self.code = code

    def set_details(self, details):
        self.details = details


def _spot(**overrides):
    values = {
        "user_id": uuid.uuid4(),
        "title": "Canyon Lookout",
        "description": "Wide sunset view",
        "latitude": 32.75,
        "longitude": -97.33,
        "city": "Fort Worth",
        "country": "US",
        "category": "scenic",
        "vibe": "calm",
        "rating": 4.8,
        "is_public": True,
        "verification_status": Spot.VERIFICATION_VERIFIED,
        "safety_status": Spot.SAFETY_CLEAN,
    }
    values.update(overrides)
    return Spot.objects.create(**values)


def test_get_spot_found_and_not_found():
    spot = _spot()
    service = grpc_services.SpotServiceServicer()

    response = service.GetSpot(spot_pb2.GetSpotRequest(id=str(spot.id)), FakeContext())

    assert response.id == str(spot.id)
    assert response.name == "Canyon Lookout"
    assert response.location.latitude == pytest.approx(32.75)
    assert response.tags == ["calm", "Fort Worth", "US"]

    context = FakeContext()
    missing = service.GetSpot(spot_pb2.GetSpotRequest(id=str(uuid.uuid4())), context)

    assert missing == spot_pb2.Spot()
    assert context.code == grpc.StatusCode.NOT_FOUND
    assert "not found" in context.details


def test_list_spots_filters_orders_paginates_and_rejects_bad_ordering():
    owner_id = uuid.uuid4()
    _spot(user_id=owner_id, title="First scenic", category="scenic")
    _spot(user_id=owner_id, title="Second food", category="food")
    _spot(title="Other scenic", category="scenic")
    service = grpc_services.SpotServiceServicer()

    response = service.ListSpots(
        spot_pb2.ListSpotsRequest(
            pagination=common_pb2.Pagination(page=1, page_size=1),
            category="scenic",
            creator_id=str(owner_id),
            ordering="title",
        ),
        FakeContext(),
    )

    assert response.meta.total == 1
    assert response.meta.page_size == 1
    assert response.spots[0].name == "First scenic"

    context = FakeContext()
    bad_response = service.ListSpots(spot_pb2.ListSpotsRequest(ordering="does_not_exist"), context)

    assert bad_response == spot_pb2.ListSpotsResponse()
    assert context.code == grpc.StatusCode.INVALID_ARGUMENT


def test_search_spots_handles_unavailable_and_success(monkeypatch):
    service = grpc_services.SpotServiceServicer()
    import common.search as search_module

    context = FakeContext()
    monkeypatch.setattr(search_module, "get_es_client", lambda: None)

    unavailable = service.SearchSpots(spot_pb2.SearchSpotsRequest(query="sunset"), context)

    assert unavailable == spot_pb2.ListSpotsResponse()
    assert context.code == grpc.StatusCode.UNAVAILABLE

    captured = {}

    class FakeClient:
        def search(self, *, index, body):
            captured["index"] = index
            captured["body"] = body
            return {
                "hits": {
                    "total": {"value": 2},
                    "hits": [
                        {
                            "_source": {
                                "id": "spot-1",
                                "title": "Skyline Deck",
                                "location": {"lat": 12.5, "lon": -44.1},
                                "tags": ["view"],
                                "rating": 4.9,
                                "review_count": 8,
                            }
                        },
                        {"_source": {"id": "spot-2", "name": "River Trail", "latitude": 1, "longitude": 2}},
                    ],
                }
            }

    monkeypatch.setattr(search_module, "get_es_client", lambda: FakeClient())

    response = service.SearchSpots(spot_pb2.SearchSpotsRequest(query="sunset", limit=5), FakeContext())

    assert captured["body"]["query"]["multi_match"]["query"] == "sunset"
    assert captured["body"]["size"] == 5
    assert response.meta.total == 2
    assert response.spots[0].name == "Skyline Deck"
    assert response.spots[0].location.longitude == pytest.approx(-44.1)


def test_get_spots_by_ids_and_proto_helpers():
    first = _spot(title="First")
    second = _spot(title="Second")
    service = grpc_services.SpotServiceServicer()

    response = service.GetSpotsByIds(spot_pb2.GetSpotsByIdsRequest(ids=[str(first.id), str(second.id)]), FakeContext())

    assert {spot.name for spot in response.spots} == {"First", "Second"}
    assert response.meta.total_pages == 1

    proto = service._source_to_proto({"id": "x", "location": "not-a-dict", "tags": [1, "two"], "user_id": uuid.uuid4()})
    assert proto.location.latitude == 0
    assert proto.tags == ["1", "two"]

    empty_timestamp = service._timestamp(None)
    assert empty_timestamp.seconds == 0

    naive_timestamp = service._timestamp(datetime(2026, 1, 1, 12, 0, 0))
    aware_timestamp = service._timestamp(timezone.now())
    assert naive_timestamp.seconds > 0
    assert aware_timestamp.seconds > 0


def test_grpc_server_start_reuse_bound_failure_and_background_thread(monkeypatch):
    grpc_server._server = None
    grpc_server._thread = None
    monkeypatch.setenv("GRPC_INTERNAL_TOKEN", TEST_GRPC_INTERNAL_TOKEN)
    calls = []

    class FakeServer:
        def __init__(self, bound_port=grpc_server.GRPC_PORT):
            self.bound_port = bound_port
            self.started = False
            self.waited = False

        def add_generic_rpc_handlers(self, handlers):
            calls.append(("handlers", len(handlers)))

        def add_registered_method_handlers(self, service_name, handlers):
            calls.append(("registered", service_name))

        def add_insecure_port(self, address):
            calls.append(("bind", address))
            return self.bound_port

        def start(self):
            self.started = True

        def wait_for_termination(self):
            self.waited = True

    fake_server = FakeServer()
    monkeypatch.setattr(grpc_server.grpc, "server", lambda executor, **_kwargs: fake_server)

    server = grpc_server.serve_grpc()

    assert server is fake_server
    assert server.started is True
    assert grpc_server.serve_grpc() is fake_server

    grpc_server._server = None
    monkeypatch.setattr(grpc_server.grpc, "server", lambda executor, **_kwargs: FakeServer(bound_port=0))
    assert grpc_server.serve_grpc() is None

    class ExistingThread:
        def is_alive(self):
            return True

    existing = ExistingThread()
    monkeypatch.setattr(grpc_server, "_thread", existing)
    assert grpc_server.start_grpc_background() is existing

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

    monkeypatch.setattr(grpc_server, "_thread", None)
    monkeypatch.setattr(grpc_server.threading, "Thread", FakeThread)
    created = grpc_server.start_grpc_background()

    assert created.name == "content-grpc"
    assert created.daemon is True
    assert created.started is True


def test_grpc_auth_interceptor_rejects_missing_token_and_accepts_internal_token():
    interceptor = grpc_server.InternalGrpcAuthInterceptor(TEST_GRPC_INTERNAL_TOKEN)
    handler = grpc.unary_unary_rpc_method_handler(lambda request, context: "ok")

    def continuation(_details):
        return handler

    rejected = interceptor.intercept_service(
        continuation,
        SimpleNamespace(method="/scope.v1.SpotService/ListSpots", invocation_metadata=[]),
    )

    class AbortContext:
        def abort(self, code, details):
            raise RuntimeError(f"{code.name}:{details}")

    with pytest.raises(RuntimeError, match="UNAUTHENTICATED"):
        rejected.unary_unary(object(), AbortContext())

    accepted = interceptor.intercept_service(
        continuation,
        SimpleNamespace(
            method="/scope.v1.SpotService/ListSpots",
            invocation_metadata=[("x-scope-internal-token", TEST_GRPC_INTERNAL_TOKEN)],
        ),
    )
    assert accepted.unary_unary(object(), object()) == "ok"

    health_handler = interceptor.intercept_service(
        continuation,
        SimpleNamespace(method="/grpc.health.v1.Health/Check", invocation_metadata=[]),
    )
    assert health_handler is handler


def test_grpc_requires_internal_token_before_starting(monkeypatch):
    monkeypatch.delenv("GRPC_INTERNAL_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="GRPC_INTERNAL_TOKEN"):
        grpc_server._require_internal_token()


def test_run_grpc_waits_and_swallows_start_errors(monkeypatch):
    class FakeServer:
        def __init__(self):
            self.waited = False

        def wait_for_termination(self):
            self.waited = True

    server = FakeServer()
    monkeypatch.setattr(grpc_server, "serve_grpc", lambda: server)
    grpc_server._run_grpc()
    assert server.waited is True

    monkeypatch.setattr(grpc_server, "serve_grpc", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    grpc_server._run_grpc()


def test_ensure_proto_path_adds_missing_path(monkeypatch):
    proto_dir = str(grpc_server.Path(grpc_server.__file__).resolve().parent / "proto")
    monkeypatch.setattr(sys, "path", [entry for entry in sys.path if entry != proto_dir])

    grpc_server._ensure_proto_path()

    assert sys.path[0] == proto_dir
