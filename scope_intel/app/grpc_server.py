"""gRPC server for Intel API - IntelService implementation."""

from __future__ import annotations

import logging
import sys
import threading
from concurrent import futures
from pathlib import Path

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

logger = logging.getLogger(__name__)

GRPC_PORT = 50052
_server: grpc.Server | None = None
_thread: threading.Thread | None = None


def _ensure_proto_path() -> None:
    proto_dir = Path(__file__).resolve().parent / "proto"
    proto_path = str(proto_dir)
    if proto_path not in sys.path:
        sys.path.insert(0, proto_path)


def serve_grpc() -> grpc.Server | None:
    """Start the Intel gRPC server."""
    global _server
    if _server is not None:
        return _server

    _ensure_proto_path()
    from app.grpc_services import IntelServiceServicer
    from scope.v1 import intel_pb2, intel_pb2_grpc

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    intel_pb2_grpc.add_IntelServiceServicer_to_server(IntelServiceServicer(), server)

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set("scope.v1.IntelService", health_pb2.HealthCheckResponse.SERVING)

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
