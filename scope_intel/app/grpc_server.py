"""gRPC server for Intel API - IntelService implementation."""

from __future__ import annotations

import logging
import hmac
import os
import sys
import threading
from concurrent import futures
from pathlib import Path

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

logger = logging.getLogger(__name__)

GRPC_PORT = 50052
GRPC_INTERNAL_TOKEN_METADATA_KEY = "x-scope-internal-token"
GRPC_AUTHORIZATION_METADATA_KEY = "authorization"
UNPROTECTED_METHOD_PREFIXES = ("/grpc.health.v1.Health/",)
_server: grpc.Server | None = None
_thread: threading.Thread | None = None


class InternalGrpcAuthInterceptor(grpc.ServerInterceptor):
    def __init__(self, internal_token: str):
        self._internal_token = internal_token

    def intercept_service(self, continuation, handler_call_details):
        handler = continuation(handler_call_details)
        if handler is None or handler_call_details.method.startswith(UNPROTECTED_METHOD_PREFIXES):
            return handler
        if _metadata_has_valid_token(handler_call_details.invocation_metadata, self._internal_token):
            return handler
        return _unauthenticated_handler(handler)


def _ensure_proto_path() -> None:
    proto_dir = Path(__file__).resolve().parent / "proto"
    proto_path = str(proto_dir)
    if proto_path not in sys.path:
        sys.path.insert(0, proto_path)


def _require_internal_token() -> str:
    token = os.environ.get("GRPC_INTERNAL_TOKEN", "").strip()
    if len(token) < 32:
        raise RuntimeError("GRPC_INTERNAL_TOKEN must be set to at least 32 characters before enabling Intel gRPC.")
    return token


def _metadata_has_valid_token(metadata, internal_token: str) -> bool:
    for key, value in metadata or ():
        normalized_key = key.lower()
        candidate = str(value)
        if normalized_key == GRPC_INTERNAL_TOKEN_METADATA_KEY:
            return hmac.compare_digest(candidate, internal_token)
        if normalized_key == GRPC_AUTHORIZATION_METADATA_KEY and candidate.lower().startswith("bearer "):
            return hmac.compare_digest(candidate[7:].strip(), internal_token)
    return False


def _unauthenticated_handler(handler):
    def abort_unary_unary(request, context):
        context.abort(grpc.StatusCode.UNAUTHENTICATED, "Missing or invalid internal gRPC token")

    def abort_unary_stream(request, context):
        context.abort(grpc.StatusCode.UNAUTHENTICATED, "Missing or invalid internal gRPC token")
        yield from ()

    def abort_stream_unary(request_iterator, context):
        context.abort(grpc.StatusCode.UNAUTHENTICATED, "Missing or invalid internal gRPC token")

    def abort_stream_stream(request_iterator, context):
        context.abort(grpc.StatusCode.UNAUTHENTICATED, "Missing or invalid internal gRPC token")
        yield from ()

    if handler.unary_unary:
        return grpc.unary_unary_rpc_method_handler(
            abort_unary_unary,
            request_deserializer=handler.request_deserializer,
            response_serializer=handler.response_serializer,
        )
    if handler.unary_stream:
        return grpc.unary_stream_rpc_method_handler(
            abort_unary_stream,
            request_deserializer=handler.request_deserializer,
            response_serializer=handler.response_serializer,
        )
    if handler.stream_unary:
        return grpc.stream_unary_rpc_method_handler(
            abort_stream_unary,
            request_deserializer=handler.request_deserializer,
            response_serializer=handler.response_serializer,
        )
    if handler.stream_stream:
        return grpc.stream_stream_rpc_method_handler(
            abort_stream_stream,
            request_deserializer=handler.request_deserializer,
            response_serializer=handler.response_serializer,
        )
    return handler


def _reflection_enabled() -> bool:
    return os.environ.get("GRPC_ENABLE_REFLECTION", "false").lower() == "true"


def serve_grpc() -> grpc.Server | None:
    """Start the Intel gRPC server."""
    global _server
    if _server is not None:
        return _server

    _ensure_proto_path()
    from app.grpc_services import IntelServiceServicer
    from scope.v1 import intel_pb2, intel_pb2_grpc

    internal_token = _require_internal_token()
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=10),
        interceptors=[InternalGrpcAuthInterceptor(internal_token)],
    )
    intel_pb2_grpc.add_IntelServiceServicer_to_server(IntelServiceServicer(), server)

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("scope.v1.IntelService", health_pb2.HealthCheckResponse.SERVING)

    if _reflection_enabled():
        service_names = (
            intel_pb2.DESCRIPTOR.services_by_name["IntelService"].full_name,
            health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
            reflection.SERVICE_NAME,
        )
        reflection.enable_server_reflection(service_names, server)

    bound_port = server.add_insecure_port(f"[::]:{GRPC_PORT}")
    if bound_port == 0:
        logger.warning("Intel gRPC port %d is already in use; skipping server start", GRPC_PORT)
        return None

    server.start()
    _server = server
    logger.info("Intel gRPC server started on port %d", GRPC_PORT)
    return server


def start_grpc_background() -> threading.Thread | None:
    """Start gRPC server in a daemon thread."""
    global _thread
    if _thread is not None and _thread.is_alive():
        return _thread

    _thread = threading.Thread(target=_run_grpc, name="intel-grpc", daemon=True)
    _thread.start()
    return _thread


def _run_grpc() -> None:
    try:
        server = serve_grpc()
        if server is not None:
            server.wait_for_termination()
    except Exception:
        logger.exception("Intel gRPC server failed")
