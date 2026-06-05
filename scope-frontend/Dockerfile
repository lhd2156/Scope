# Pin node to 20-alpine; in release builds, append @sha256:<digest> so a
# compromised alpine tag cannot swap the build toolchain silently.
FROM node:20-alpine AS build
WORKDIR /workspace/scope-frontend

ARG VITE_API_BASE_URL=/
ARG VITE_MAPBOX_TOKEN=
ARG VITE_CSRF_ENDPOINT=
ARG VITE_ENABLE_LOCAL_PREVIEW=false
ARG VITE_LOCAL_PREVIEW_LOGIN_EMAIL=
ARG VITE_LOCAL_PREVIEW_LOGIN_PASSWORD=
ARG VITE_ENABLE_COGNITO_OAUTH=false
ARG VITE_OPENWEATHERMAP_API_KEY=
ARG VITE_WEB_PUSH_PUBLIC_KEY=
ARG VITE_DISABLE_SERVICE_WORKER=false
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=
ARG VITE_SENTRY_RELEASE=
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0.1

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    VITE_CSRF_ENDPOINT=$VITE_CSRF_ENDPOINT \
    VITE_ENABLE_LOCAL_PREVIEW=$VITE_ENABLE_LOCAL_PREVIEW \
    VITE_LOCAL_PREVIEW_LOGIN_EMAIL=$VITE_LOCAL_PREVIEW_LOGIN_EMAIL \
    VITE_LOCAL_PREVIEW_LOGIN_PASSWORD=$VITE_LOCAL_PREVIEW_LOGIN_PASSWORD \
    VITE_ENABLE_COGNITO_OAUTH=$VITE_ENABLE_COGNITO_OAUTH \
    VITE_OPENWEATHERMAP_API_KEY=$VITE_OPENWEATHERMAP_API_KEY \
    VITE_WEB_PUSH_PUBLIC_KEY=$VITE_WEB_PUSH_PUBLIC_KEY \
    VITE_DISABLE_SERVICE_WORKER=$VITE_DISABLE_SERVICE_WORKER \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE \
    VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE

COPY scope-frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY scope-frontend/ ./
COPY scope-assets ../scope-assets
RUN npm run build

# Nginx pinned to 1.27-alpine; append @sha256:<digest> in release builds.
FROM nginx:1.27-alpine
# Install curl for healthcheck and drop setuid bits that are unnecessary for a static SPA.
RUN apk add --no-cache curl \
    && find / -xdev \( -perm -4000 -o -perm -2000 \) -exec chmod ug-s {} + 2>/dev/null || true
COPY --from=build /workspace/scope-frontend/dist /usr/share/nginx/html
RUN printf 'server {\n\
  listen 8080;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  add_header X-Content-Type-Options "nosniff" always;\n\
  add_header X-Frame-Options "DENY" always;\n\
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), interest-cohort=()" always;\n\
  add_header Cross-Origin-Opener-Policy "same-origin" always;\n\
  # index.html must never be cached by CDNs or browsers: it references hashed\n\
  # asset bundles and a stale copy strands users on a previous deploy.\n\
  location = / { add_header Cache-Control "no-cache, no-store, must-revalidate" always; try_files $uri /index.html; }\n\
  location = /index.html { add_header Cache-Control "no-cache, no-store, must-revalidate" always; }\n\
  location / { try_files $uri $uri/ /index.html; }\n\
  location = /healthz { access_log off; return 200; }\n\
  # Vite emits content-hashed filenames for assets under /assets/ so those are\n\
  # safe to cache immutably for a year.\n\
  location ^~ /assets/ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable" always; access_log off; }\n\
  location ~* \\.(?:js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|webp|ico)$ { expires 7d; add_header Cache-Control "public, max-age=604800, immutable"; }\n\
}\n' > /etc/nginx/conf.d/default.conf \
 && sed -i 's/^user.*nginx;/user nginx;/' /etc/nginx/nginx.conf \
 && sed -i 's,/var/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf \
 && sed -i 's,/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx /usr/share/nginx/html \
 && touch /tmp/nginx.pid \
 && chown nginx:nginx /tmp/nginx.pid

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
