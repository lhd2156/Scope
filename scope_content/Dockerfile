FROM python:3.12-slim@sha256:090ba77e2958f6af52a5341f788b50b032dd4ca28377d2893dcf1ecbdfdfe203
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Secrets must be supplied at runtime, NOT baked into image layers.
# `collectstatic` runs at build time with a throwaway key set only inside the
# RUN instruction so it never persists in the image or metadata.

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg unixodbc \
    && . /etc/os-release \
    && curl -sSL -O "https://packages.microsoft.com/config/debian/${VERSION_ID%%.*}/packages-microsoft-prod.deb" \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10002 scope \
    && useradd --system --uid 10002 --gid scope --home /app --shell /usr/sbin/nologin scope

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN DJANGO_SECRET_KEY="collectstatic-ephemeral" \
    CORE_JWT_SECRET="collectstatic-ephemeral-key-must-be-32-bytes-or-longer" \
    DEBUG=false \
    ALLOWED_HOSTS=localhost \
    FRONTEND_ORIGIN=http://localhost \
    DJANGO_DATABASE_URL=sqlite:////tmp/scope-collectstatic.sqlite3 \
    python manage.py collectstatic --noinput \
    && sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh \
    && chmod +x /app/scripts/docker-entrypoint.sh \
    && chown -R scope:scope /app

USER scope
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/content/health || exit 1
# ENTRYPOINT (not CMD) so the migration gate runs for every runtime shape —
# the web server, the Kafka thumbnail worker, ad-hoc `manage.py` invocations,
# etc. Args passed via compose `command:` are forwarded to `exec "$@"` inside
# the entrypoint.
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD []
