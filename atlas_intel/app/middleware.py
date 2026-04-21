import time
from flask import Flask, g, request
from app.config import settings
from app.telemetry import begin_request_span, finish_request_span, normalize_route, record_request_metrics


def register_middleware(app: Flask) -> None:
    @app.before_request
    def before_request():
        g.started_at = time.perf_counter()
        g.trace_id = request.headers.get("X-Correlation-Id", f"trace-{int(time.time() * 1000)}")
        g.request_span, g.request_span_token = begin_request_span(
            request.method,
            request.path,
            g.trace_id,
        )

    @app.after_request
    def after_request(response):
        duration_ms = round((time.perf_counter() - g.started_at) * 1000, 2)
        route = normalize_route(request.url_rule.rule if request.url_rule else request.path)
        record_request_metrics(request.method, route, response.status_code, duration_ms / 1000)
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
                "correlation_id": g.trace_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        response.headers["X-Correlation-Id"] = g.trace_id
        return response
