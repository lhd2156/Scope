#!/bin/sh
set -eu

# Migrations are idempotent but expensive when every replica of a scaled
# deployment tries to take the schema lock at boot. In production, run
# migrations exactly once via the dedicated `content-migrate` compose service
# (or a Kubernetes Job / init container) and set RUN_MIGRATIONS_ON_STARTUP=false
# on the serving replicas. Dev/local keeps the default true so `docker compose
# up` still bootstraps the DB on first run.
if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
    python manage.py migrate --noinput
fi

# When invoked with arguments (e.g. by the migration or worker compose service),
# exec them directly instead of starting the web server. This keeps the image
# a single-responsibility entrypoint while allowing multiple runtime shapes.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Production-grade WSGI server. Workers and timeouts are tunable via env.
# Fall back to Django's dev server only when explicitly requested (SCOPE_CONTENT_DEV_SERVER=true).
if [ "${SCOPE_CONTENT_DEV_SERVER:-false}" = "true" ]; then
    exec python manage.py runserver 0.0.0.0:8000
fi

# Gunicorn tuning notes:
#   * --worker-class gthread: the default 'sync' worker ignores --threads and
#     serializes every request per-worker. Switching to 'gthread' lets each
#     worker handle multiple concurrent requests via a threadpool — essential
#     for our I/O-bound mix (DB + S3 + Kafka + Core).
#   * --preload: loads the Django app in the master once, then forks workers
#     with copy-on-write pages. Saves ~25–40% worker RSS and cuts cold-start
#     time because model compilation / URL resolution runs once.
#   * --worker-tmp-dir /dev/shm: gunicorn's heartbeat files go to a tmpfs so
#     they don't touch disk on every beat; avoids EBS IOPS pressure and, more
#     importantly, avoids the well-known "worker killed" false positives when
#     a laggy disk misses the heartbeat window.
#   * --max-requests / --max-requests-jitter: recycle workers on a cadence so
#     any slow memory leak (e.g. in third-party ODBC drivers) bleeds off
#     before it forces an OOM kill. Jitter prevents synchronized recycles
#     across workers from causing a coordinated latency dip.
exec gunicorn scope_content.wsgi:application \
    --bind 0.0.0.0:8000 \
    --worker-class "${GUNICORN_WORKER_CLASS:-gthread}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    --threads "${GUNICORN_THREADS:-8}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
    --keep-alive "${GUNICORN_KEEPALIVE:-5}" \
    --worker-connections "${GUNICORN_WORKER_CONNECTIONS:-1000}" \
    --worker-tmp-dir "${GUNICORN_WORKER_TMP_DIR:-/dev/shm}" \
    --max-requests "${GUNICORN_MAX_REQUESTS:-1000}" \
    --max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER:-100}" \
    ${GUNICORN_PRELOAD:+--preload} \
    --access-logfile - \
    --error-logfile - \
    --log-level "${GUNICORN_LOG_LEVEL:-info}"
