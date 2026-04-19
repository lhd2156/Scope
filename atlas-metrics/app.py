import os
import time
from dataclasses import dataclass

import requests
from flask import Flask, Response, jsonify
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Gauge, generate_latest

app = Flask(__name__)
registry = CollectorRegistry()

service_up = Gauge(
    "atlas_service_up",
    "Whether an Atlas dependency health check responded successfully.",
    ["service", "url"],
    registry=registry,
)
service_latency_seconds = Gauge(
    "atlas_service_response_seconds",
    "Response latency for Atlas dependency health checks.",
    ["service", "url"],
    registry=registry,
)
last_refresh_success = Gauge(
    "atlas_metrics_last_refresh_success",
    "Whether the most recent dependency refresh completed successfully.",
    registry=registry,
)
metrics_build_info = Gauge(
    "atlas_metrics_build_info",
    "Static build metadata for the Atlas metrics service.",
    ["version"],
    registry=registry,
)
metrics_build_info.labels(version=os.getenv("ATLAS_METRICS_VERSION", "0.1.0")).set(1)


@dataclass(frozen=True)
class Target:
    name: str
    url: str


def configured_targets() -> list[Target]:
    return [
        Target("core", os.getenv("ATLAS_CORE_HEALTH_URL", "http://localhost:5001/api/core/health")),
        Target(
            "content",
            os.getenv("ATLAS_CONTENT_HEALTH_URL", "http://localhost:5002/api/content/health"),
        ),
        Target("intel", os.getenv("ATLAS_INTEL_HEALTH_URL", "http://localhost:5003/api/intel/health")),
    ]


def refresh_metrics() -> bool:
    timeout = float(os.getenv("ATLAS_HEALTH_TIMEOUT_SECONDS", "5"))
    success = True

    for target in configured_targets():
        started = time.perf_counter()

        try:
            response = requests.get(target.url, timeout=timeout)
            latency = time.perf_counter() - started
            service_latency_seconds.labels(service=target.name, url=target.url).set(latency)
            service_up.labels(service=target.name, url=target.url).set(1 if response.ok else 0)
            if not response.ok:
                success = False
        except requests.RequestException:
            service_latency_seconds.labels(service=target.name, url=target.url).set(0)
            service_up.labels(service=target.name, url=target.url).set(0)
            success = False

    last_refresh_success.set(1 if success else 0)
    return success


@app.get("/")
def index() -> Response:
    return jsonify(
        {
            "service": "atlas-metrics",
            "status": "ok",
            "targets": [target.__dict__ for target in configured_targets()],
        }
    )


@app.get("/healthz")
def healthz() -> Response:
    refresh_metrics()
    return jsonify({"status": "ok"})


@app.get("/metrics")
def metrics() -> Response:
    refresh_metrics()
    return Response(generate_latest(registry), mimetype=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    port = int(os.getenv("ATLAS_METRICS_PORT", os.getenv("PORT", "9090")))
    app.run(host="0.0.0.0", port=port)
