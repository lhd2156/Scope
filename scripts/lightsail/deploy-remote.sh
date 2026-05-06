#!/usr/bin/env bash
set -euo pipefail

release_dir="${SCOPE_RELEASE_DIR:-${1:-$(pwd)}}"
sqlcmd_path="/opt/mssql-tools18/bin/sqlcmd"

compose() {
  (
    cd "$release_dir"
    docker compose "$@"
  )
}

wait_for_health() {
  local service="$1"
  local timeout_seconds="${2:-600}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local container_id
    container_id="$(compose ps -q "$service" | head -n 1)"
    if [[ -n "$container_id" ]]; then
      local status
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        printf '[scope-lightsail] %s is %s\n' "$service" "$status"
        return 0
      fi
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
      printf '[scope-lightsail] Timed out waiting for %s to become healthy.\n' "$service" >&2
      compose ps >&2 || true
      compose logs --tail=200 "$service" >&2 || true
      return 1
    fi

    sleep 5
  done
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-300}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl --fail --silent --show-error --insecure "$url" >/dev/null; then
      printf '[scope-lightsail] %s is reachable\n' "$url"
      return 0
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
      printf '[scope-lightsail] Timed out waiting for %s.\n' "$url" >&2
      return 1
    fi

    sleep 5
  done
}

if [[ ! -f "$release_dir/docker-compose.yml" ]]; then
  printf '[scope-lightsail] Missing docker-compose.yml under %s\n' "$release_dir" >&2
  exit 1
fi

if [[ ! -f "$release_dir/.env" ]]; then
  printf '[scope-lightsail] Missing .env under %s\n' "$release_dir" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$release_dir/.env"
set +a

if [[ -z "${SA_PASSWORD:-}" ]]; then
  printf '[scope-lightsail] SA_PASSWORD must be present in the runtime environment.\n' >&2
  exit 1
fi

mkdir -p /opt/scope
ln -sfn "$release_dir" /opt/scope/current

printf '[scope-lightsail] Starting Scope infrastructure services from %s\n' "$release_dir"
compose up -d --build sqlserver zookeeper kafka redis

wait_for_health sqlserver 900
wait_for_health zookeeper 300
wait_for_health kafka 600
wait_for_health redis 300

printf '[scope-lightsail] Ensuring ScopeDb exists and bootstrapping Core schema.\n'
compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d master -Q "IF DB_ID(N'ScopeDb') IS NULL CREATE DATABASE ScopeDb;"
compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d ScopeDb -i /docker-entrypoint-initdb.d/core/001_core_schema.sql

if [[ -f "$release_dir/scripts/sql/core/003_security_enhancements.sql" ]]; then
  compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d ScopeDb -i /docker-entrypoint-initdb.d/core/003_security_enhancements.sql
fi

printf '[scope-lightsail] Starting Scope application services.\n'
compose up -d --build content intel core content-worker scope-metrics frontend nginx

wait_for_health content 900
wait_for_health intel 600
wait_for_health core 600
wait_for_health scope-metrics 600
wait_for_health nginx 300

printf '[scope-lightsail] Ensuring Kafka topics exist.\n'
compose --profile init up --abort-on-container-exit --exit-code-from kafka-init kafka-init

wait_for_http "https://127.0.0.1/healthz" 300
wait_for_http "https://127.0.0.1/api/core/health" 300
wait_for_http "https://127.0.0.1/api/content/health" 300
wait_for_http "https://127.0.0.1/api/intel/health" 300

printf '[scope-lightsail] Scope deployment finished successfully.\n'
compose ps
