# Phase 6: Grafana + Rate Limiting + Sentry — Codex Build Spec

> **Scope**: Add Grafana observability dashboards, Redis-based rate limiting across all APIs, and Sentry error tracking.
> **Prerequisites**: Phases 1–2 (Redis + Prometheus metrics agent already running).
> **Cost**: $0. All open source / free tier.

---

## Part A: Grafana + Prometheus Dashboards

### A1. Docker Compose

**File**: `docker-compose.yml` (MODIFY — add before `volumes:`)

```yaml
  prometheus:
    image: prom/prometheus:v3.4.0
    container_name: scope-prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "${PROMETHEUS_PORT:-9091}:9090"
    depends_on:
      scope-metrics:
        condition: service_started
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://localhost:9090/-/healthy || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    mem_limit: 256m

  grafana:
    image: grafana/grafana-oss:11.6.0
    container_name: scope-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-scope_dev}
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports:
      - "${GRAFANA_PORT:-3001}:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      prometheus:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://localhost:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 15s
    mem_limit: 256m
```

Add to `volumes:` section:
```yaml
  prometheus-data:
  grafana-data:
```

### A2. Prometheus Config

**File**: `monitoring/prometheus.yml` (NEW)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "scope-metrics"
    static_configs:
      - targets: ["scope-metrics:9090"]
    metrics_path: /metrics

  - job_name: "core"
    static_configs:
      - targets: ["core:8080"]
    metrics_path: /metrics

  - job_name: "content"
    static_configs:
      - targets: ["content:8000"]
    metrics_path: /api/content/metrics

  - job_name: "intel"
    static_configs:
      - targets: ["intel:5000"]
    metrics_path: /api/intel/metrics

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

### A3. Grafana Provisioning — Data Source

**File**: `monitoring/grafana/provisioning/datasources/prometheus.yml` (NEW)

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### A4. Grafana Provisioning — Dashboard Provider

**File**: `monitoring/grafana/provisioning/dashboards/default.yml` (NEW)

```yaml
apiVersion: 1

providers:
  - name: Scope Dashboards
    orgId: 1
    folder: Scope
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

### A5. Pre-built Dashboard

**File**: `monitoring/grafana/dashboards/scope-overview.json` (NEW)

```json
{
  "dashboard": {
    "id": null,
    "uid": "scope-overview",
    "title": "Scope — Service Overview",
    "tags": ["scope"],
    "timezone": "browser",
    "refresh": "10s",
    "time": { "from": "now-1h", "to": "now" },
    "panels": [
      {
        "id": 1,
        "title": "Service Health Status",
        "type": "stat",
        "gridPos": { "h": 4, "w": 24, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "up",
            "legendFormat": "{{job}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              { "options": { "0": { "text": "DOWN", "color": "red" }, "1": { "text": "UP", "color": "green" } }, "type": "value" }
            ]
          }
        }
      },
      {
        "id": 2,
        "title": "HTTP Request Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 },
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{job}} {{method}} {{status}}"
          }
        ]
      },
      {
        "id": 3,
        "title": "HTTP Request Latency (p95)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{job}} p95"
          }
        ]
      },
      {
        "id": 4,
        "title": "Error Rate (5xx)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 },
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "{{job}} 5xx"
          }
        ]
      },
      {
        "id": 5,
        "title": "Memory Usage",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 12 },
        "targets": [
          {
            "expr": "process_resident_memory_bytes",
            "legendFormat": "{{job}}"
          }
        ]
      }
    ]
  },
  "overwrite": true
}
```

### A6. Environment Variables

**File**: `.env.example` (MODIFY — append)

```env
# ── Monitoring ─────────────────────────────────────
PROMETHEUS_PORT=9091
GRAFANA_PORT=3001
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=scope_dev
```

---

## Part B: Rate Limiting

### B1. Nginx — Global Edge Rate Limiting

**File**: `nginx/nginx.conf` (MODIFY — add at the top, before `server` block)

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_global:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=search:10m rate=30r/m;

limit_req_status 429;
```

Add to specific location blocks inside the `server` block:

```nginx
location /api/core/auth/ {
    limit_req zone=auth burst=5 nodelay;
    proxy_pass http://core:8080;
}

location /api/content/search {
    limit_req zone=search burst=10 nodelay;
    proxy_pass http://content:8000;
}

location /api/ {
    limit_req zone=api_global burst=20 nodelay;
    proxy_pass http://core:8080;
}
```

### B2. Core API — ASP.NET Rate Limiting

.NET 8 has built-in rate limiting. Modify `Scope.Core/Scope.Core.API/Program.cs`:

```csharp
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

// Add before app.Build():
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Global policy: 100 requests/minute per IP
    options.AddFixedWindowLimiter("global", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 10;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });

    // Strict policy for auth endpoints: 10 requests/minute per IP
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 2;
    });

    // IP-based key
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error = "Rate limit exceeded. Try again later.",
            retryAfterSeconds = 60,
        }, ct);
    };
});

// Add after app.Build(), before app.MapControllers():
app.UseRateLimiter();
```

Apply to controllers:
```csharp
[EnableRateLimiting("auth")]
[Route("api/core/auth")]
public class AuthController : ControllerBase { ... }

[EnableRateLimiting("global")]
[Route("api/core/users")]
public class UsersController : ControllerBase { ... }
```

### B3. Content API — Django Rate Limiting

**File**: `scope_content/requirements.txt` (MODIFY — append)

```
django-ratelimit>=4.1.0
```

**File**: `scope_content/common/middleware/ratelimit.py` (NEW)

```python
"""Redis-based rate limiting middleware for Django."""

import json
import logging
import time

from django.http import JsonResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    """Sliding window rate limiter using Redis.

    Limits: 100 requests/minute per IP for general endpoints,
    10 requests/minute for auth endpoints.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            try:
                import redis as redis_lib
                import os
                url = os.environ.get("DJANGO_CACHE_LOCATION", "redis://redis:6379/1")
                self._redis = redis_lib.from_url(url)
            except Exception:
                logger.warning("Redis unavailable for rate limiting")
                return None
        return self._redis

    def __call__(self, request):
        client = self._get_redis()
        if client is None:
            return self.get_response(request)

        ip = self._get_client_ip(request)
        path = request.path

        # Determine limit
        if "/auth/" in path:
            limit, window = 10, 60
            key = f"rl:auth:{ip}"
        elif "/search" in path:
            limit, window = 30, 60
            key = f"rl:search:{ip}"
        else:
            limit, window = 100, 60
            key = f"rl:global:{ip}"

        # Sliding window counter
        now = time.time()
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window)
        results = pipe.execute()
        request_count = results[1]

        if request_count >= limit:
            return JsonResponse(
                {"error": "Rate limit exceeded. Try again later.", "retry_after_seconds": window},
                status=429,
                headers={"Retry-After": str(window)},
            )

        response = self.get_response(request)
        response["X-RateLimit-Limit"] = str(limit)
        response["X-RateLimit-Remaining"] = str(max(0, limit - request_count - 1))
        return response

    @staticmethod
    def _get_client_ip(request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")
```

Add to Django `MIDDLEWARE` in `settings.py`:
```python
MIDDLEWARE = [
    # ... existing middleware ...
    "common.middleware.ratelimit.RateLimitMiddleware",
]
```

### B4. Intel API — Flask Rate Limiting

**File**: `scope_intel/requirements.txt` (MODIFY — append)

```
Flask-Limiter>=3.12.0
```

Add to Flask app factory (`scope_intel/app/__init__.py` or wherever `create_app()` is):

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="redis://redis:6379/3",
)

def create_app():
    app = Flask(__name__)
    limiter.init_app(app)
    # ... existing setup ...

# Apply stricter limits to specific routes:
@bp.route("/classify-image", methods=["POST"])
@limiter.limit("20/minute")
def classify():
    ...

@bp.route("/agent/plan-trip", methods=["POST"])
@limiter.limit("5/minute")  # AI agent is expensive
def plan():
    ...
```

### B5. Rate Limit Tests

**File**: `scope_content/common/tests/test_ratelimit.py` (NEW)

```python
"""Tests for rate limiting middleware."""

import pytest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory

from common.middleware.ratelimit import RateLimitMiddleware


class TestRateLimitMiddleware:
    def test_allows_requests_under_limit(self):
        factory = RequestFactory()
        request = factory.get("/api/content/spots/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 5, None, None]  # 5 requests (under limit)
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: MagicMock(status_code=200, __setitem__=MagicMock()))
        middleware._redis = mock_redis

        response = middleware(request)
        assert response.status_code != 429

    def test_blocks_requests_over_limit(self):
        factory = RequestFactory()
        request = factory.get("/api/content/spots/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 100, None, None]  # At limit
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: MagicMock(status_code=200))
        middleware._redis = mock_redis

        response = middleware(request)
        assert response.status_code == 429

    def test_auth_endpoints_have_stricter_limit(self):
        factory = RequestFactory()
        request = factory.post("/api/content/auth/login")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value = [None, 10, None, None]  # At auth limit (10)
        mock_redis.pipeline.return_value = mock_pipe

        middleware = RateLimitMiddleware(lambda r: MagicMock(status_code=200))
        middleware._redis = mock_redis

        response = middleware(request)
        assert response.status_code == 429
```

---

## Part C: Sentry Error Tracking

### C1. Sentry Options

**Option A (easiest)**: Use free Sentry cloud — [sentry.io](https://sentry.io), free tier = 50K errors/month. Create a project, get a DSN.

**Option B (self-hosted)**: Run Sentry via Docker. Heavy (~2GB RAM). Only do this if you want to flex self-hosted observability.

**Recommended**: Option A (cloud free tier). Faster, no infra overhead.

### C2. Python — Content API

**File**: `scope_content/requirements.txt` (MODIFY — append)

```
sentry-sdk[django]>=2.22.0
```

Add to `scope_content/scope_content/settings.py`:

```python
import sentry_sdk

SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment=os.environ.get("DJANGO_ENV", "development"),
        send_default_pii=False,
    )
```

### C3. Python — Intel API

**File**: `scope_intel/requirements.txt` (MODIFY — append)

```
sentry-sdk[flask]>=2.22.0
```

Add to Flask app factory:

```python
import sentry_sdk

sentry_dsn = os.environ.get("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.1,
        environment=os.environ.get("FLASK_ENV", "development"),
        send_default_pii=False,
    )
```

### C4. Python — RAG Service

**File**: `scope-rag/requirements.txt` (MODIFY — append)

```
sentry-sdk[fastapi]>=2.22.0
```

Add to `scope-rag/app/main.py`:

```python
import os
import sentry_sdk

sentry_dsn = os.environ.get("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=0.1,
        environment=os.environ.get("ENV", "development"),
        send_default_pii=False,
    )
```

### C5. C# — Core API

Add NuGet package to `Scope.Core.API.csproj`:

```xml
<PackageReference Include="Sentry.AspNetCore" Version="5.6.0" />
```

Add to `Program.cs`:

```csharp
// Before builder.Build()
builder.WebHost.UseSentry(o =>
{
    o.Dsn = builder.Configuration["SENTRY_DSN"] ?? "";
    o.TracesSampleRate = 0.1;
    o.Environment = builder.Environment.EnvironmentName;
    o.SendDefaultPii = false;
});

// After app.Build(), before other middleware
app.UseSentryTracing();
```

### C6. TypeScript — Frontend

**File**: `scope-frontend/package.json` (MODIFY — add to dependencies)

```json
"@sentry/vue": "^9.13.0"
```

Add to `scope-frontend/src/main.ts`:

```typescript
import * as Sentry from "@sentry/vue";

const app = createApp(App);

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}
```

### C7. Go — Metrics Agent

**File**: `scope-metrics/go.mod` (MODIFY — add)

```
github.com/getsentry/sentry-go v0.32.0
```

Add to `main.go`:

```go
import "github.com/getsentry/sentry-go"

func main() {
    dsn := os.Getenv("SENTRY_DSN")
    if dsn != "" {
        sentry.Init(sentry.ClientOptions{
            Dsn:              dsn,
            TracesSampleRate: 0.1,
            Environment:     os.Getenv("ENV"),
        })
        defer sentry.Flush(2 * time.Second)
    }
    // ... rest of main
}
```

### C8. Environment Variables

**File**: `.env.example` (MODIFY — append)

```env
# ── Sentry ─────────────────────────────────────────
SENTRY_DSN=
VITE_SENTRY_DSN=
```

Add `SENTRY_DSN` to every service's environment in `docker-compose.yml`:
```yaml
      SENTRY_DSN: ${SENTRY_DSN:-}
```

Add `VITE_SENTRY_DSN` to the `frontend` service build args:
```yaml
      args:
        VITE_SENTRY_DSN: ${VITE_SENTRY_DSN:-}
```

---

## Validation Checklist

```powershell
# 1. Start monitoring stack
docker compose up --build -d prometheus grafana

# 2. Open Grafana
# http://localhost:3001 (admin / scope_dev)
# Navigate to Dashboards → Scope → Scope — Service Overview
# Verify panels show UP status for all services

# 3. Verify Prometheus targets
# http://localhost:9091/targets — all targets should be UP

# 4. Test rate limiting — Nginx
for ($i = 0; $i -lt 70; $i++) { curl -s -o $null -w "%{http_code}`n" http://localhost/api/content/spots/ }
# Should see 429 responses after ~60 requests

# 5. Test rate limiting — Auth (stricter)
for ($i = 0; $i -lt 15; $i++) { curl -s -o $null -w "%{http_code}`n" -X POST http://localhost/api/core/auth/login }
# Should see 429 after ~10 requests

# 6. Verify Sentry (if DSN configured)
# Trigger a test error and check sentry.io dashboard
curl http://localhost/api/content/sentry-test  # if you add a test endpoint

# 7. Run tests
cd scope_content; python -m pytest common/tests/test_ratelimit.py -v
```

---

## Files Created / Modified Summary

| Action | File |
|---|---|
| NEW | `monitoring/prometheus.yml` |
| NEW | `monitoring/grafana/provisioning/datasources/prometheus.yml` |
| NEW | `monitoring/grafana/provisioning/dashboards/default.yml` |
| NEW | `monitoring/grafana/dashboards/scope-overview.json` |
| NEW | `scope_content/common/middleware/__init__.py` |
| NEW | `scope_content/common/middleware/ratelimit.py` |
| NEW | `scope_content/common/tests/test_ratelimit.py` |
| MODIFY | `docker-compose.yml` (add prometheus, grafana + volumes + SENTRY_DSN everywhere) |
| MODIFY | `nginx/nginx.conf` (add rate limit zones) |
| MODIFY | `.env.example` (add monitoring + Sentry vars) |
| MODIFY | `Scope.Core/Scope.Core.API/Program.cs` (add rate limiter + Sentry) |
| MODIFY | `Scope.Core/Scope.Core.API/Scope.Core.API.csproj` (add Sentry NuGet) |
| MODIFY | `scope_content/requirements.txt` (add django-ratelimit, sentry-sdk) |
| MODIFY | `scope_content/scope_content/settings.py` (add Sentry init + middleware) |
| MODIFY | `scope_intel/requirements.txt` (add Flask-Limiter, sentry-sdk) |
| MODIFY | `scope_intel/app/__init__.py` (add limiter + Sentry) |
| MODIFY | `scope-rag/requirements.txt` (add sentry-sdk) |
| MODIFY | `scope-rag/app/main.py` (add Sentry init) |
| MODIFY | `scope-frontend/package.json` (add @sentry/vue) |
| MODIFY | `scope-frontend/src/main.ts` (add Sentry init) |
| MODIFY | `scope-metrics/go.mod` (add sentry-go) |
| MODIFY | `scope-metrics/cmd/scope-metrics/main.go` (add Sentry init) |
