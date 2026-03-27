import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from flask import Flask, g, request
from app.config import settings
from app.responses import error_response

_request_windows: dict[str, deque[float]] = defaultdict(deque)


def register_middleware(app: Flask) -> None:
    @app.before_request
    def before_request():
        g.started_at = time.perf_counter()
        g.trace_id = request.headers.get("X-Correlation-Id", f"trace-{int(time.time() * 1000)}")
        client_key = request.headers.get("Authorization", request.remote_addr or "anonymous")
        now = datetime.now(tz=timezone.utc).timestamp()
        window = _request_windows[client_key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= settings.rate_limit_per_minute and request.endpoint != "health.health":
            return error_response(429, "RATE_LIMITED", "Too many requests", trace_id=g.trace_id)
        window.append(now)

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
