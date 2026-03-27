#!/usr/bin/env sh
set -eu

SQL_HOST="${DB_HOST:-sqlserver}"
SQL_PORT="${DB_PORT:-1433}"
KAFKA_HOST="${KAFKA_HOST:-kafka}"
KAFKA_PORT="${KAFKA_PORT_INTERNAL:-9092}"
ZOOKEEPER_HOST="${ZOOKEEPER_HOST:-zookeeper}"
ZOOKEEPER_PORT="${ZOOKEEPER_PORT_INTERNAL:-2181}"
TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-120}"

wait_for_port() {
  service_name="$1"
  host="$2"
  port="$3"
  elapsed=0

  printf 'Waiting for %s at %s:%s\n' "$service_name" "$host" "$port"
  while ! nc -z "$host" "$port" >/dev/null 2>&1; do
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
      printf 'Timed out waiting for %s after %ss\n' "$service_name" "$TIMEOUT_SECONDS" >&2
      exit 1
    fi
    sleep 2
  done

  printf '%s is reachable\n' "$service_name"
}

wait_for_port "sqlserver" "$SQL_HOST" "$SQL_PORT"
wait_for_port "zookeeper" "$ZOOKEEPER_HOST" "$ZOOKEEPER_PORT"
wait_for_port "kafka" "$KAFKA_HOST" "$KAFKA_PORT"

printf 'All foundation services are reachable\n'
