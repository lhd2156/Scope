from __future__ import annotations

import os
from typing import Final

from flask import Flask, Response
from opentelemetry import context, trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

SERVICE_NAME: Final[str] = 'scope-intel'
_INITIALIZED = False

HTTP_REQUESTS = Counter(
    'scope_intel_http_requests_total',
    'Total Scope Intel HTTP requests.',
    ('method', 'route', 'status_code'),
)
HTTP_REQUEST_DURATION = Histogram(
    'scope_intel_http_request_duration_seconds',
    'Scope Intel HTTP request latency.',
    ('method', 'route'),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
SERVICE_HEALTH = Gauge(
    'scope_intel_service_health',
    'Scope Intel health status reported by the health endpoint.',
    ('service',),
)


def _trace_exporter_endpoint() -> str | None:
    endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', '').strip()
    if not endpoint:
        return None
    if endpoint.endswith('/v1/traces'):
        return endpoint
    return f"{endpoint.rstrip('/')}/v1/traces"


def initialize_telemetry() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return

    provider = TracerProvider(resource=Resource.create({'service.name': SERVICE_NAME}))
    exporter_endpoint = _trace_exporter_endpoint()
    if exporter_endpoint:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=exporter_endpoint)))

    trace.set_tracer_provider(provider)
    _INITIALIZED = True


def begin_request_span(method: str, path: str, correlation_id: str | None):
    initialize_telemetry()
    tracer = trace.get_tracer(__name__)
    span = tracer.start_span(f'{method} {path}', kind=SpanKind.SERVER)
    span.set_attribute('http.request.method', method)
    span.set_attribute('url.path', path)
    if correlation_id:
        span.set_attribute('scope.correlation_id', correlation_id)
    token = context.attach(trace.set_span_in_context(span))
    return span, token


def finish_request_span(
    span,
    token,
    *,
    route: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    span.set_attribute('http.route', normalize_route(route))
    span.set_attribute('http.response.status_code', status_code)
    span.set_attribute('scope.request.duration_seconds', duration_seconds)
    if status_code >= 500:
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_status(Status(StatusCode.OK))
    span.end()
    context.detach(token)


def record_request_metrics(method: str, route: str, status_code: int, duration_seconds: float) -> None:
    normalized_route = normalize_route(route)
    HTTP_REQUESTS.labels(method, normalized_route, str(status_code)).inc()
    HTTP_REQUEST_DURATION.labels(method, normalized_route).observe(duration_seconds)


def record_service_health(service: str, healthy: bool) -> None:
    SERVICE_HEALTH.labels(service).set(1 if healthy else 0)


def _parse_cidrs(raw: str) -> list[tuple[str, int]]:
    import ipaddress

    parsed: list[tuple[str, int]] = []
    for item in (raw or '').replace(';', ',').split(','):
        entry = item.strip()
        if not entry:
            continue
        try:
            network = ipaddress.ip_network(entry, strict=False)
        except ValueError:
            continue
        parsed.append((str(network.network_address), network.prefixlen))
    return parsed


def _metrics_allowlist_networks() -> list:
    import ipaddress

    raw = os.getenv('METRICS_ALLOWED_CIDRS', '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8,::1/128')
    networks = []
    for addr, prefix in _parse_cidrs(raw):
        try:
            networks.append(ipaddress.ip_network(f'{addr}/{prefix}', strict=False))
        except ValueError:
            continue
    return networks


def register_metrics_endpoint(app: Flask) -> None:
    import ipaddress

    from flask import abort, request
    from app.rate_limit import rate_limited

    allowlist = _metrics_allowlist_networks()

    @app.get('/metrics')
    @app.get('/api/intel/metrics')
    @rate_limited
    def metrics() -> Response:
        remote = request.remote_addr or ''
        try:
            caller = ipaddress.ip_address(remote)
        except ValueError:
            abort(403)
        if not any(caller in network for network in allowlist):
            abort(403)
        initialize_telemetry()
        return Response(generate_latest(), content_type=CONTENT_TYPE_LATEST)


def normalize_route(route: str | None) -> str:
    if not route:
        return '/'
    return route if route.startswith('/') else f'/{route}'
