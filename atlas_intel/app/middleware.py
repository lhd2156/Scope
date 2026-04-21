import time
from flask import Flask, g, request
from app.config import settings


def register_middleware(app: Flask) -> None:
    @app.before_request
    def before_request():
        g.started_at = time.perf_counter()
        g.trace_id = request.headers.get("X-Correlation-Id", f"trace-{int(time.time() * 1000)}")

    @app.after_request
    def after_request(response):
        duration_ms = round((time.perf_counter() - g.started_at) * 1000, 2)
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
