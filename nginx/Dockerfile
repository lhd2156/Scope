FROM nginxinc/nginx-unprivileged:stable-alpine3.23@sha256:de3e40ec8b7debd7194fc798d4bbfb102c7f8b012b2c73032816b5f72393acdd

USER root

RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs /var/www/certbot /var/cache/nginx \
    && chown -R 101:101 /etc/nginx/certs /var/www/certbot /var/cache/nginx

COPY --chown=101:101 nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 nginx/security-headers.conf /etc/nginx/snippets/scope-security-headers.conf
COPY --chown=101:101 scripts/nginx/bootstrap-tls.sh /docker-entrypoint.d/10-scope-bootstrap-tls.sh

RUN sed -i 's/\r$//' /docker-entrypoint.d/10-scope-bootstrap-tls.sh \
    && chmod 0555 /docker-entrypoint.d/10-scope-bootstrap-tls.sh

USER 101:101

EXPOSE 8080 8443

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
