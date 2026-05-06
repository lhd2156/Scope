# Pin to python:3.12-slim; for release builds, append @sha256:<digest>.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5000

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10003 scope \
    && useradd --system --uid 10003 --gid scope --home /app --shell /usr/sbin/nologin scope

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .
RUN chown -R scope:scope /app

USER scope
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:5000/api/intel/health || exit 1
# Gunicorn tuning for the Intel workload (ML scoring + Content HTTP fetch):
#   * --worker-class gthread: our workers are I/O-bound (HTTP to Content,
#     OTEL export, DB) with short bursts of CPU-bound scoring offloaded to
#     the internal ML thread pool. gthread beats the default 'sync' class
#     (which ignores --threads and serializes requests per worker).
#   * --preload: build the Flask app once in the master, fork workers with
#     copy-on-write memory. Combined with INTEL_WARMUP_RECOMMENDATIONS=true,
#     the TF-IDF index is built once and shared via CoW — first-request
#     latency drops from ~150ms to <10ms.
#   * --worker-tmp-dir /dev/shm: gunicorn heartbeat files live on tmpfs so a
#     laggy disk doesn't trigger false "worker timeout" kills.
#   * --max-requests / --max-requests-jitter: recycle workers to cap any slow
#     leaks from sklearn/numpy array pools; jitter avoids synchronized dips.
#   * --timeout: local Ollama agent requests can be CPU-bound and slow, so keep
#     the worker deadline longer than nginx's AI proxy read timeout.
#   * --graceful-timeout: drain in-flight ML requests on rolling deploys.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--worker-class", "gthread", \
     "--workers", "2", \
     "--threads", "8", \
     "--worker-connections", "1000", \
     "--worker-tmp-dir", "/dev/shm", \
     "--preload", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--timeout", "180", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "wsgi:app"]
