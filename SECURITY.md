# Scope Security Policy

Scope is a multi-service real-world adventure platform. We take security
seriously across every tier (Core/C#, Content/Django, Intel/Flask, Vue SPA,
Nginx edge, infrastructure). This document describes our baseline posture,
what to do if you discover a vulnerability, and the standards every commit
must meet.

## Reporting a vulnerability

- Email: `security@scope.example.com` (PGP key published on the website).
- Do **not** open public GitHub issues for suspected vulnerabilities.
- Include reproduction steps, affected services/versions, and expected impact.
- We triage within **2 business days** and aim to ship a fix inside **30 days**
  for high/critical issues.
- Coordinated disclosure only. Please allow us to patch before publishing.

### Scope
In scope: all services under this repository, deployed infrastructure
(Terraform/K8s), and any image we publish to GHCR.

Out of scope: social-engineering, DDoS, rate-limit-bypass via residential
proxy rotation, and findings only reproducible on clients that opt in to
`VITE_ENABLE_AUTH_MOCK_FALLBACK=true` (development convenience).

## Security baseline (must-haves before merging)

### Application

- **Authentication:** Core issues HS256 JWTs with a >=32-byte secret
  (`CORE_JWT_SECRET`). Tokens carry `iss`, `aud`, `sub`, `exp`. No default
  fallback secret exists.
- **Password storage:** bcrypt with work factor 12. Password policy enforces
  >=10 chars + 3 of 4 character classes + contextual checks (no username,
  no email local-part, not a top-50 common password).
- **Breach check (opt-in):** When `Hibp__Enabled=true`, registration and
  password-reset paths call Have-I-Been-Pwned via the k-anonymity range API
  (first 5 SHA-1 hex chars only). Check is fail-open so HIBP outages cannot
  block user flows. Local policy is always enforced.
- **Account lockout:** 5 consecutive failed logins lock the account for 15
  minutes. Lockout state is audit-logged.
- **Refresh tokens:** stored as SHA-256 hashes. Plaintext values are never
  persisted or logged. Single-use rotation with replay detection: presenting
  an already-rotated or revoked token revokes every active refresh token
  for that user.
- **Password reset:** `POST /api/core/auth/password-reset/request` issues a
  cryptographically random token stored as a SHA-256 hash with a 30-minute
  expiry. Endpoint always returns 202 regardless of account existence to
  prevent enumeration. Completing a reset revokes all active refresh tokens.
- **Email verification:** `POST /api/core/auth/email/verify/send` issues a
  24-hour token (hashed at rest). Resend is throttled to one request per
  5 minutes per account.
- **TOTP MFA:** RFC 6238 SHA-1 TOTP, 6-digit / 30-second step, +/- 1 step
  drift tolerance. Shared secret stored base-32 encoded; recovery codes
  stored as SHA-256 hashes and single-use. Login returns `{ mfaRequired:true }`
  401 when MFA is enabled and no code provided, prompting the client to
  collect a code and retry.
- **Authorization:** Every mutating endpoint validates resource ownership /
  membership. Use the project's helpers (`User.GetRequiredUserId()`,
  `can_manage_trip`, `IsAuthenticatedJWT`).
- **CORS:** Allowlisted origins only. Wildcards combined with credentials are
  a release-blocker.
- **Rate limiting:** In-process per-IP limits for auth and global paths. Edge
  Nginx applies its own `limit_req` for defense in depth.
- **Input validation:** DRF serializers or C# `[ApiController]` model binding
  with explicit DTOs. No raw SQL string interpolation.
- **CSP / security headers:** Emitted by Core middleware, Django middleware,
  and the edge Nginx. Any page that requires a new external origin must
  update the CSP explicitly.

### Secrets & configuration

- `.env` files and anything matching `auth-profiles.json`, `credentials*.json`,
  `*.pem`, `*.key`, `*.pfx` are gitignored.
- `.env.example` only contains placeholders (`CHANGE_ME_*`).
- CI workflows generate ephemeral values at runtime and never hard-code
  passwords or JWT secrets.
- Real credentials live in the platform's secret manager (GitHub encrypted
  secrets, AWS Secrets Manager, or k8s Secrets sealed with SOPS).
- Database access uses a least-privilege `scope_app` user. `sa` is reserved
  for schema bootstrap in local Docker only.

### Runtime & infra

- Every service container runs as a non-root user (`scope`, UID 10001/10002/
  10003, or `nginx`), drops all Linux capabilities, and runs with
  `no-new-privileges`.
- Production deployments must pin image digests, set `Encrypt=True` on SQL
  connections, and use CA-signed certificates (no `TrustServerCertificate`).
- Swagger UI is disabled outside Development unless `ENABLE_SWAGGER=true` is
  set explicitly. `/metrics` is served only to the private network allowlist
  (`METRICS_ALLOWED_CIDRS`).
- Nginx terminates at the edge and emits HSTS, CSP, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy`.

## SDLC controls

Each pull request runs the full CI pipeline
(`.github/workflows/ci.yml`) which enforces:

| Control | Tooling |
|---|---|
| Static analysis (C#, Python, JS/TS) | GitHub CodeQL |
| Secret scanning | gitleaks (+ `.github/gitleaks.toml`) |
| Dependency CVE scanning | `dotnet list package --vulnerable`, `pip-audit`, `npm audit` |
| Filesystem & image vulnerability scan | Trivy (SARIF uploaded) |
| Django production hardening | `manage.py check --deploy` |
| Unit & integration tests | xUnit, pytest, Vitest |

Merging to `main` additionally requires:

- All CI jobs green (including the security jobs above).
- At least one reviewer approval.
- Dependabot alerts triaged within 7 days for High/Critical, 30 days for
  others. Configure these in the repo settings.

## Incident response

1. Identify scope and contain (rotate affected secrets, revoke tokens, take
   offending services offline if necessary).
2. Page the on-call via the #scope-security channel or PagerDuty.
3. File a post-incident review within 5 business days using the template in
   `docs/incident-template.md`.
4. Commit remediations with `fix(security): ...` scope and link to the
   incident ticket.

## Credential rotation runbook

If a secret is discovered in logs, repository history, chats, screenshots,
etc., rotate immediately:

- `CORE_JWT_SECRET`: generate a new 48-byte value (`openssl rand -base64 48`)
  and restart the Core deployment. All outstanding JWTs and refresh tokens
  become invalid.
- `DJANGO_SECRET_KEY`: rotate via secret manager; Django sessions will be
  invalidated.
- `FLASK_SECRET_KEY`: rotate; Flask sessions will be invalidated.
- Database `scope_app` password: rotate, update secrets, apply migration.
- Cloud / provider tokens (e.g. OpenAI, AWS, Mapbox): revoke at the provider,
  rotate, and document the incident.

Never edit history to remove secrets—rotate them. History rewrites are only
acceptable under the direction of the security team.
