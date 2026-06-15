#!/usr/bin/env bash
set -euo pipefail

release_dir="${SCOPE_RELEASE_DIR:-${1:-$(pwd)}}"
sqlcmd_path="/opt/mssql-tools18/bin/sqlcmd"

compose() {
  (
    cd "$release_dir"
    local compose_files=(-f docker-compose.yml)
    if [[ -f docker-compose.data.yml ]]; then
      compose_files+=(-f docker-compose.data.yml)
    fi
    docker compose "${compose_files[@]}" "$@"
  )
}

initialize_data_directories() {
  local data_root="$1"

  sudo mkdir -p \
    "$data_root/sqlserver" \
    "$data_root/zookeeper-data" \
    "$data_root/zookeeper-log" \
    "$data_root/kafka" \
    "$data_root/media" \
    "$data_root/intel" \
    "$data_root/rag" \
    "$data_root/ollama"
  sudo chown -R 10001:10001 "$data_root/sqlserver" || true
  sudo chown -R 1000:1000 "$data_root/zookeeper-data" "$data_root/zookeeper-log" "$data_root/kafka" || true
  sudo chown -R 10002:10002 "$data_root/media" || true
  sudo chown -R 10003:10003 "$data_root/intel" || true
  sudo chown -R 10004:10004 "$data_root/rag" || true
  sudo chown -R 1000:1000 "$data_root/ollama" || true
}

prepare_data_disk() {
  local data_device="${SCOPE_DATA_DEVICE:-/dev/xvdf}"
  local data_root="${SCOPE_DATA_ROOT:-/opt/scope/shared}"

  if [[ ! -b "$data_device" ]]; then
    printf '[scope-lightsail] Data disk %s not present; using %s on the root volume.\n' "$data_device" "$data_root"
    initialize_data_directories "$data_root"
    return 0
  fi

  printf '[scope-lightsail] Preparing data disk %s at %s.\n' "$data_device" "$data_root"
  sudo mkdir -p "$data_root"

  if ! sudo blkid "$data_device" >/dev/null 2>&1; then
    sudo mkfs.ext4 -F "$data_device"
  fi

  local data_uuid
  data_uuid="$(sudo blkid -s UUID -o value "$data_device")"
  if ! grep -q "UUID=${data_uuid} " /etc/fstab; then
    printf 'UUID=%s %s ext4 defaults,nofail 0 2\n' "$data_uuid" "$data_root" | sudo tee -a /etc/fstab >/dev/null
  fi

  if ! findmnt -rn --target "$data_root" >/dev/null 2>&1; then
    sudo mount "$data_root"
  fi

  initialize_data_directories "$data_root"
}

write_data_volume_override() {
  cat > "$release_dir/docker-compose.data.yml" <<'YAML'
volumes:
  sqlserver-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/sqlserver
  zookeeper-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/zookeeper-data
  zookeeper-log:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/zookeeper-log
  kafka-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/kafka
  content-media:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/media
  intel-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/intel
  rag-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/rag
  ollama-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${SCOPE_DATA_ROOT:-/opt/scope/shared}/ollama
YAML
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

wait_for_trusted_https() {
  local host="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl --fail --silent --show-error "https://${host}/healthz" >/dev/null; then
      printf '[scope-lightsail] Trusted TLS is serving https://%s/healthz\n' "$host"
      return 0
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
      printf '[scope-lightsail] Timed out waiting for trusted TLS at https://%s/healthz.\n' "$host" >&2
      return 1
    fi

    sleep 5
  done
}

read_env_value() {
  local key="$1"
  local default_value="${2:-}"
  local env_line env_value first_char last_char

  while IFS= read -r env_line || [[ -n "$env_line" ]]; do
    env_line="${env_line%$'\r'}"
    [[ "$env_line" =~ ^[[:space:]]*(#|$) ]] && continue
    if [[ "$env_line" =~ ^[[:space:]]*${key}[[:space:]]*=(.*)$ ]]; then
      env_value="${BASH_REMATCH[1]}"
      env_value="${env_value#"${env_value%%[![:space:]]*}"}"
      env_value="${env_value%"${env_value##*[![:space:]]}"}"
      if [[ ${#env_value} -ge 2 ]]; then
        first_char="${env_value:0:1}"
        last_char="${env_value: -1}"
        if [[ ("$first_char" == '"' && "$last_char" == '"') || ("$first_char" == "'" && "$last_char" == "'") ]]; then
          env_value="${env_value:1:${#env_value}-2}"
        fi
      fi
      printf '%s' "$env_value"
      return 0
    fi
  done < "$release_dir/.env"

  printf '%s' "$default_value"
}

is_dns_hostname() {
  local host="$1"
  [[ "$host" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] &&
    [[ ! "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

install_tls_renewal_cron() {
  local tls_hostname="$1"
  local cron_file="/etc/cron.d/scope-certbot-renew"
  local cron_command

  cron_command='cd /opt/scope/current && compose_files="-f docker-compose.yml"; [ -f docker-compose.data.yml ] && compose_files="$compose_files -f docker-compose.data.yml"; docker compose $compose_files --profile tls run --rm certbot renew --webroot --webroot-path /var/www/certbot --config-dir /etc/letsencrypt --work-dir /var/lib/letsencrypt --logs-dir /var/log/letsencrypt --quiet && docker compose $compose_files --profile tls run --rm --entrypoint /bin/sh certbot -c "cp -L /etc/letsencrypt/live/'"${tls_hostname}"'/fullchain.pem /etc/letsencrypt/fullchain.pem && cp -L /etc/letsencrypt/live/'"${tls_hostname}"'/privkey.pem /etc/letsencrypt/privkey.pem && chmod 644 /etc/letsencrypt/fullchain.pem && chmod 600 /etc/letsencrypt/privkey.pem" && docker compose $compose_files exec -T nginx nginx -s reload'

  sudo mkdir -p "$(dirname "$cron_file")"
  {
    printf 'SHELL=/bin/bash\n'
    printf 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n'
    printf '17 3,15 * * * root %s\n' "$cron_command"
  } | sudo tee "$cron_file" >/dev/null
  sudo chmod 0644 "$cron_file"
  printf '[scope-lightsail] Installed TLS renewal cron at %s.\n' "$cron_file"
}

ensure_trusted_tls() {
  local require_trusted_tls="${SCOPE_REQUIRE_TRUSTED_TLS:-false}"
  local tls_hostname="${SCOPE_TLS_HOSTNAME:-}"
  local tls_email="${SCOPE_TLS_EMAIL:-}"

  if [[ "$require_trusted_tls" != "true" ]]; then
    printf '[scope-lightsail] SCOPE_REQUIRE_TRUSTED_TLS is not true; keeping mounted or bootstrap TLS material.\n'
    return 0
  fi

  if [[ -z "$tls_hostname" ]] || ! is_dns_hostname "$tls_hostname"; then
    printf '[scope-lightsail] SCOPE_TLS_HOSTNAME must be a real DNS hostname for trusted production TLS.\n' >&2
    return 1
  fi

  if [[ -z "$tls_email" ]] || [[ ! "$tls_email" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
    printf '[scope-lightsail] SCOPE_TLS_EMAIL must be set to a valid ACME registration email.\n' >&2
    return 1
  fi

  printf '[scope-lightsail] Requesting/renewing trusted TLS certificate for %s.\n' "$tls_hostname"
  compose --profile tls run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --config-dir /etc/letsencrypt \
    --work-dir /var/lib/letsencrypt \
    --logs-dir /var/log/letsencrypt \
    --email "$tls_email" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    -d "$tls_hostname"

  compose --profile tls run --rm --entrypoint /bin/sh certbot -c \
    "cp -L /etc/letsencrypt/live/${tls_hostname}/fullchain.pem /etc/letsencrypt/fullchain.pem && cp -L /etc/letsencrypt/live/${tls_hostname}/privkey.pem /etc/letsencrypt/privkey.pem && chmod 644 /etc/letsencrypt/fullchain.pem && chmod 600 /etc/letsencrypt/privkey.pem"

  compose exec -T nginx nginx -s reload
  install_tls_renewal_cron "$tls_hostname"
  wait_for_trusted_https "$tls_hostname" 180
}

if [[ ! -f "$release_dir/docker-compose.yml" ]]; then
  printf '[scope-lightsail] Missing docker-compose.yml under %s\n' "$release_dir" >&2
  exit 1
fi

if [[ ! -f "$release_dir/.env" ]]; then
  printf '[scope-lightsail] Missing .env under %s\n' "$release_dir" >&2
  exit 1
fi

if command -v sed >/dev/null 2>&1; then
  sed -i 's/\r$//' "$release_dir/.env" "$release_dir/docker-compose.yml" 2>/dev/null || true
  find "$release_dir/scripts" -type f -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
fi

prepare_data_disk
write_data_volume_override

SA_PASSWORD="$(read_env_value SA_PASSWORD "${SA_PASSWORD:-}")"
CORE_JWT_SECRET="$(read_env_value CORE_JWT_SECRET "${CORE_JWT_SECRET:-}")"
GRPC_INTERNAL_TOKEN="$(read_env_value GRPC_INTERNAL_TOKEN "${GRPC_INTERNAL_TOKEN:-}")"
RABBITMQ_USER="$(read_env_value RABBITMQ_USER "${RABBITMQ_USER:-scope}")"
RABBITMQ_PASS="$(read_env_value RABBITMQ_PASS "${RABBITMQ_PASS:-}")"
RABBITMQ_VHOST="$(read_env_value RABBITMQ_VHOST "${RABBITMQ_VHOST:-scope}")"
SCOPE_TLS_HOSTNAME="$(read_env_value SCOPE_TLS_HOSTNAME "${SCOPE_TLS_HOSTNAME:-}")"
SCOPE_TLS_EMAIL="$(read_env_value SCOPE_TLS_EMAIL "${SCOPE_TLS_EMAIL:-}")"
SCOPE_REQUIRE_TRUSTED_TLS="$(read_env_value SCOPE_REQUIRE_TRUSTED_TLS "${SCOPE_REQUIRE_TRUSTED_TLS:-false}")"
SCOPE_RUN_STARTER_SEED="$(read_env_value SCOPE_RUN_STARTER_SEED "${SCOPE_RUN_STARTER_SEED:-false}")"
export SA_PASSWORD
export CORE_JWT_SECRET
export GRPC_INTERNAL_TOKEN
export RABBITMQ_USER
export RABBITMQ_PASS
export RABBITMQ_VHOST
export SCOPE_TLS_HOSTNAME
export SCOPE_TLS_EMAIL
export SCOPE_REQUIRE_TRUSTED_TLS
export SCOPE_RUN_STARTER_SEED

if [[ -z "${SA_PASSWORD:-}" ]]; then
  printf '[scope-lightsail] SA_PASSWORD must be present in the runtime environment.\n' >&2
  exit 1
fi

if [[ ${#GRPC_INTERNAL_TOKEN} -lt 32 ]]; then
  printf '[scope-lightsail] GRPC_INTERNAL_TOKEN must be at least 32 characters.\n' >&2
  exit 1
fi

if [[ "$GRPC_INTERNAL_TOKEN" == "$CORE_JWT_SECRET" ]]; then
  printf '[scope-lightsail] GRPC_INTERNAL_TOKEN must be distinct from CORE_JWT_SECRET.\n' >&2
  exit 1
fi

if [[ -z "$RABBITMQ_PASS" ]]; then
  printf '[scope-lightsail] RABBITMQ_PASS must be present in the runtime environment.\n' >&2
  exit 1
fi

mkdir -p /opt/scope
ln -sfn "$release_dir" /opt/scope/current

printf '[scope-lightsail] Starting Scope infrastructure services from %s\n' "$release_dir"
compose up -d --build sqlserver zookeeper kafka redis rabbitmq elasticsearch ollama

wait_for_health sqlserver 900
wait_for_health zookeeper 300
wait_for_health kafka 600
wait_for_health redis 300
wait_for_health rabbitmq 300
wait_for_health elasticsearch 600
wait_for_health ollama 600

printf '[scope-lightsail] Reconciling RabbitMQ runtime credentials and vhost.\n'
if compose exec -T rabbitmq rabbitmqctl list_users --silent |
  awk '{print $1}' |
  grep -Fxq "$RABBITMQ_USER"; then
  compose exec -T rabbitmq rabbitmqctl change_password "$RABBITMQ_USER" "$RABBITMQ_PASS"
else
  compose exec -T rabbitmq rabbitmqctl add_user "$RABBITMQ_USER" "$RABBITMQ_PASS"
fi
if ! compose exec -T rabbitmq rabbitmqctl list_vhosts --silent |
  grep -Fxq "$RABBITMQ_VHOST"; then
  compose exec -T rabbitmq rabbitmqctl add_vhost "$RABBITMQ_VHOST"
fi
compose exec -T rabbitmq rabbitmqctl set_permissions \
  -p "$RABBITMQ_VHOST" "$RABBITMQ_USER" '.*' '.*' '.*'

printf '[scope-lightsail] Ensuring Kafka topics exist.\n'
compose --profile init up --abort-on-container-exit --exit-code-from kafka-init kafka-init

printf '[scope-lightsail] Ensuring ScopeDb exists and bootstrapping Core schema.\n'
compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d master -Q "IF DB_ID(N'ScopeDb') IS NULL CREATE DATABASE ScopeDb;"
compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d ScopeDb -i /docker-entrypoint-initdb.d/core/001_core_schema.sql

for core_script in \
  003_security_enhancements.sql \
  004_notifications_platform.sql \
  005_datetimeoffset_alignment.sql \
  006_showcase_users.sql \
  007_profile_privacy.sql
do
  if [[ -f "$release_dir/scripts/sql/core/$core_script" ]]; then
    compose exec -T sqlserver "$sqlcmd_path" -C -S localhost -U sa -P "$SA_PASSWORD" -d ScopeDb -i "/docker-entrypoint-initdb.d/core/$core_script"
  fi
done

printf '[scope-lightsail] Starting Scope application services.\n'
compose up -d --build content intel core content-worker content-celery rag scope-metrics frontend site admin prometheus grafana
compose up -d --build --force-recreate nginx

wait_for_health content 900
wait_for_health content-celery 600
wait_for_health intel 600
wait_for_health rag 600
wait_for_health core 600
wait_for_health scope-metrics 600
wait_for_health prometheus 300
wait_for_health grafana 300
wait_for_health frontend 300
wait_for_health site 300
wait_for_health admin 300
wait_for_health nginx 300

if [[ "$SCOPE_RUN_STARTER_SEED" == "true" ]]; then
  printf '[scope-lightsail] Running starter showcase seed.\n'
  compose --profile ops run --rm --build scope-cli seed --directory /workspace/scripts/sql
else
  printf '[scope-lightsail] SCOPE_RUN_STARTER_SEED is not true; skipping starter showcase seed.\n'
fi

ensure_trusted_tls

wait_for_http "https://127.0.0.1/healthz" 300
wait_for_http "https://127.0.0.1/api/core/health" 300
wait_for_http "https://127.0.0.1/api/content/health" 300
wait_for_http "https://127.0.0.1/api/intel/health" 300
wait_for_http "https://127.0.0.1/api/rag/health" 300
wait_for_http "https://127.0.0.1/site/" 300
wait_for_http "https://127.0.0.1/admin/" 300

printf '[scope-lightsail] Scope deployment finished successfully.\n'
compose ps
