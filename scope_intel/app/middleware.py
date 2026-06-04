import re
import time
import uuid

from flask import Flask, g, request

from app.config import settings
from app.telemetry import (
    begin_request_span,
    finish_request_span,
    normalize_route,
    record_request_metrics,
)

# Mirrors the Core and Content correlation id sanitizer. We only trust ids
# that match this pattern, otherwise we mint our own so a caller can't smuggle
# newlines or log-forging payloads through the header.
_SAFE_CORRELATION = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def _correlation_id() -> str:
    raw = request.headers.get("X-Correlation-Id", "")
    if raw and _SAFE_CORRELATION.match(raw):
        return raw
    return uuid.uuid4().hex


def register_middleware(app: Flask) -> None:
    @app.before_request
    def before_request():
        g.started_at = time.perf_counter()
        g.trace_id = _correlation_id()
        g.request_span, g.request_span_token = begin_request_span(
            request.method,
            request.path,
            g.trace_id,
        )

    @app.after_request
    def after_request(response):
        started_at = getattr(g, "started_at", time.perf_counter())
        trace_id = getattr(g, "trace_id", _correlation_id())
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        route = normalize_route(request.url_rule.rule if request.url_rule else request.path)
        record_request_metrics(request.method, route, response.status_code, duration_ms / 1000)
        if hasattr(g, "request_span") and hasattr(g, "request_span_token"):
            finish_request_span(
                g.request_span,
                g.request_span_token,
                route=route,
                status_code=response.status_code,
                duration_seconds=duration_ms / 1000,
            )
        app.logger.info(
            "request_complete",
            extra={
                "service": settings.service_name,
                "correlation_id": trace_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        response.headers["X-Correlation-Id"] = trace_id
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response
