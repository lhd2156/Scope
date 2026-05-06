#!/bin/sh
# Scope Nginx TLS bootstrap.
#
# Ensures /etc/nginx/certs/fullchain.pem + privkey.pem exist before Nginx
# starts. In production you should mount real cert material (Let's Encrypt,
# ACM, etc.) into this directory and this script becomes a no-op. In local
# development we generate a self-signed pair on first boot so the SPA can be
# served over HTTPS with browser-trust warnings, which is strictly better
# than running plaintext.
#
# This script is intended to run as the nginx image entrypoint; invoke real
# nginx afterwards via `exec nginx -g 'daemon off;'`.

set -eu

CERT_DIR="${CERT_DIR:-/etc/nginx/certs}"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"
SCOPE_TLS_HOSTNAME="${SCOPE_TLS_HOSTNAME:-localhost}"

mkdir -p "${CERT_DIR}"

if [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; then
    echo "[scope-tls] Existing TLS material found at ${CERT_DIR}; skipping self-signed generation."
    exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
    echo "[scope-tls] openssl missing; cannot generate self-signed certificate." >&2
    echo "[scope-tls] Install openssl in the nginx image or mount real certs at ${CERT_DIR}." >&2
    exit 1
fi

echo "[scope-tls] Generating 2048-bit self-signed RSA cert for ${SCOPE_TLS_HOSTNAME} (dev use only)."
SAN_ENTRIES="DNS:${SCOPE_TLS_HOSTNAME},DNS:localhost,IP:127.0.0.1"
if printf '%s' "${SCOPE_TLS_HOSTNAME}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    SAN_ENTRIES="IP:${SCOPE_TLS_HOSTNAME},DNS:localhost,IP:127.0.0.1"
elif printf '%s' "${SCOPE_TLS_HOSTNAME}" | grep -q ':'; then
    SAN_ENTRIES="IP:${SCOPE_TLS_HOSTNAME},DNS:localhost,IP:127.0.0.1"
fi

openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -days 825 \
    -subj "/CN=${SCOPE_TLS_HOSTNAME}/O=Scope Dev/C=US" \
    -addext "subjectAltName=${SAN_ENTRIES}" \
    -addext "keyUsage=digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth"
chmod 600 "${KEY_FILE}"
echo "[scope-tls] Wrote ${CERT_FILE} and ${KEY_FILE}."
