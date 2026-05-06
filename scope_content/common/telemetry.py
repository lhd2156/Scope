from __future__ import annotations

import os
from contextlib import AbstractContextManager
from typing import Final

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode
from prometheus_client import Counter, Gauge, Histogram, generate_latest

SERVICE_NAME: Final[str] = 'scope-content'
_INITIALIZED = False

HTTP_REQUESTS = Counter(
    'scope_content_http_requests_total',
    'Total Scope Content HTTP requests.',
    ('method', 'route', 'status_code'),
)
HTTP_REQUEST_DURATION = Histogram(
    'scope_content_http_request_duration_seconds',
    'Scope Content HTTP request latency.',
    ('method', 'route'),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
SERVICE_HEALTH = Gauge(
    'scope_content_service_health',
    'Scope Content health status reported by the health endpoint.',
    ('service',),
)

# Kafka producer / consumer metrics.
#
# These feed the most important scaling signal for an event-driven service:
# `KAFKA_CONSUMER_LAG` tells you when a worker replica is falling behind the
# producer and it's time to scale out. The other two track throughput and
# failure classes so dashboards can catch broker partitioning / auth issues
# before they mature into data loss.
#
# Why labels stop at topic (and partition for lag): label cardinality is the
# silent killer of Prometheus exporters. Keeping it bounded to topics we own
# (~dozen) + a small partition count keeps the scrape cheap.
KAFKA_EVENTS_PRODUCED = Counter(
    'scope_content_kafka_events_produced_total',
    'Kafka events produced by scope-content, labeled by topic and outcome.',
    ('topic', 'status'),
)
KAFKA_EVENTS_CONSUMED = Counter(
    'scope_content_kafka_events_consumed_total',
    'Kafka events consumed by scope-content workers.',
    ('topic', 'consumer_group', 'status'),
)
KAFKA_CONSUMER_LAG = Gauge(
    'scope_content_kafka_consumer_lag',
    'Observed lag between broker highwater and consumer position (records).',
    ('topic', 'partition', 'consumer_group'),
)


def record_kafka_produced(topic: str, *, status: str = 'ok') -> None:
    """Increment the producer counter. Failures should use status='error'."""
    KAFKA_EVENTS_PRODUCED.labels(topic, status).inc()


def record_kafka_consumed(topic: str, consumer_group: str, *, status: str = 'ok') -> None:
    KAFKA_EVENTS_CONSUMED.labels(topic, consumer_group, status).inc()


def record_kafka_consumer_lag(topic: str, partition: int | str, consumer_group: str, lag: int) -> None:
    """Track the distance between our position and the broker highwater mark.

    Partition is coerced to a string so the metric label is stable whether
    callers pass an int (kafka-python) or a TopicPartition tuple.
    """
    KAFKA_CONSUMER_LAG.labels(topic, str(partition), consumer_group).set(max(0, int(lag)))


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
        current_span.set_attribute('scope.correlation_id', correlation_id)
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
    span.set_attribute('scope.request.duration_seconds', duration_seconds)
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
