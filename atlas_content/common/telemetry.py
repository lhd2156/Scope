from __future__ import annotations

import os
from contextlib import AbstractContextManager
from typing import Final

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode

SERVICE_NAME: Final[str] = 'atlas-content'
_INITIALIZED = False

HTTP_REQUESTS = Counter(
    'atlas_content_http_requests_total',
    'Total Atlas Content HTTP requests.',
    ('method', 'route', 'status_code'),
)
HTTP_REQUEST_DURATION = Histogram(
    'atlas_content_http_request_duration_seconds',
    'Atlas Content HTTP request latency.',
    ('method', 'route'),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
SERVICE_HEALTH = Gauge(
    'atlas_content_service_health',
    'Atlas Content health status reported by the health endpoint.',
    ('service',),
)


def _trace_exporter_endpoint() -> str | None:
    endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', '').strip()
    if not endpoint:
        return None
    if endpoint.endswith('/v1/traces'):
        return endpoint
    return f"{endpoint.rstrip('/')}/v1/traces"


def ensure_telemetry_initialized() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return

    provider = TracerProvider(resource=Resource.create({'service.name': SERVICE_NAME}))
    exporter_endpoint = _trace_exporter_endpoint()
    if exporter_endpoint:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=exporter_endpoint)))

    trace.set_tracer_provider(provider)
    _INITIALIZED = True


def start_request_span(method: str, path: str, correlation_id: str | None) -> AbstractContextManager:
    ensure_telemetry_initialized()
    tracer = trace.get_tracer(__name__)
    span_name = f'{method} {path}'
    span = tracer.start_as_current_span(span_name, kind=SpanKind.SERVER)
    current_span = span.__enter__()
    current_span.set_attribute('http.request.method', method)
    current_span.set_attribute('url.path', path)
    if correlation_id:
        current_span.set_attribute('atlas.correlation_id', correlation_id)
    return span


def finish_request_span(
    span_context: AbstractContextManager,
    *,
    route: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    span = trace.get_current_span()
    span.set_attribute('http.route', route)
    span.set_attribute('http.response.status_code', status_code)
    span.set_attribute('atlas.request.duration_seconds', duration_seconds)
    if status_code >= 500:
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_status(Status(StatusCode.OK))
    span_context.__exit__(None, None, None)


def record_request_metrics(method: str, route: str, status_code: int, duration_seconds: float) -> None:
    normalized_route = normalize_route(route)
    HTTP_REQUESTS.labels(method, normalized_route, str(status_code)).inc()
    HTTP_REQUEST_DURATION.labels(method, normalized_route).observe(duration_seconds)


def record_service_health(service: str, healthy: bool) -> None:
    SERVICE_HEALTH.labels(service).set(1 if healthy else 0)


def render_metrics() -> bytes:
    ensure_telemetry_initialized()
    return generate_latest()


def normalize_route(route: str | None) -> str:
    if not route:
        return '/'
    return route if route.startswith('/') else f'/{route}'

