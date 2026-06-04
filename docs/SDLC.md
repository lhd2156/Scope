# Scope SDLC

This document defines the software development life cycle (SDLC) used for Scope.
It is meant to make repository work reviewable, auditable, and release-ready
without turning day-to-day development into ceremony.

## Purpose

Scope is a polyglot, multi-service platform. A change can touch browser UI,
backend APIs, data models, infrastructure, deployment automation, or all of
those at once. The SDLC keeps those changes disciplined:

- every change has a reason
- service ownership stays clear
- security and privacy risks are considered early
- behavior is verified with the right tests
- deployments are repeatable
- rollback and production verification are not improvised

## SDLC Model

Scope uses a practical eight-phase SDLC.

| Phase | Goal | Required evidence |
|---|---|---|
| 1. Intake | Define the problem and owner | Issue, task note, PR summary, or milestone context |
| 2. Requirements | Capture expected behavior and constraints | Acceptance notes, API contract, UX expectation, or operational requirement |
| 3. Design | Choose the service boundary and technical approach | Architecture/API docs, schema notes, migration plan, or PR design note |
| 4. Implementation | Make the smallest coherent code change | Scoped commits, service ownership respected, no unrelated churn |
| 5. Verification | Prove behavior works | Unit, integration, e2e, smoke, coverage, or manual validation |
| 6. Security Review | Check risk before merge | Auth, authorization, validation, secrets, dependency, and data-flow review |
| 7. Release | Package and deploy repeatably | CI green, release checklist, deployment notes, rollback notes |
| 8. Operate | Monitor and improve after release | Health checks, metrics, logs, smoke checks, incidents, follow-up tickets |

## Service Ownership

Each change should stay inside the owning service unless it is intentionally
cross-service.

| Area | Directory | Owner responsibility |
|---|---|---|
| Core API | `Scope.Core/` | auth, users, friendships, notifications, live sessions |
| Content API | `scope_content/` | spots, trips, photos, reviews, feed |
| Intel API | `scope_intel/` | itinerary generation, recommendations, vibe matching |
| RAG API | `scope-rag/` | retrieval, app catalog context, Scope AI chat grounding |
| Frontend | `scope-frontend/` | Vue app, browser integrations, e2e flows |
| Admin | `scope-admin/` | operational/admin UI |
| Site | `scope-site/` | public site |
| Metrics | `scope-metrics/` | Prometheus exporter, probes, alerts |
| CLI | `scope-cli/` | health checks, seeding, deploy validation, benchmarking |
| Geo | `scope_geo/` | geospatial primitives and bindings |
| Media | `scope_media/` | image/media processing helpers |
| Infrastructure | `docker-compose.yml`, `k8s/`, `terraform/`, `nginx/` | local, staging, production deployment assets |

## Entry Criteria

Before implementation starts, the contributor should know:

- what behavior is changing
- which service owns the change
- whether data contracts or migrations are affected
- whether auth, privacy, payment-like flows, uploads, or secrets are involved
- how the change will be tested
- whether rollout or rollback needs special handling

For small fixes, this can be a short PR summary. For larger work, use a design
note in the PR or a doc under `docs/`.

## Implementation Rules

- Respect service boundaries from `CONTRIBUTING.md`.
- Prefer existing framework and helper patterns over new abstractions.
- Keep changes scoped to the requested behavior.
- Update API docs when request/response contracts change.
- Add migrations when persistence changes.
- Keep deployment assets aligned when ports, env vars, health checks, or
  service names change.
- Do not commit secrets, real user data, local credentials, or generated
  debug artifacts.

## Verification Policy

Verification should match the risk of the change.

| Change type | Minimum verification |
|---|---|
| Pure docs | Markdown review, links checked if practical |
| Small frontend behavior | Focused unit/component test |
| Shared frontend workflow | Unit/component tests plus relevant Playwright smoke when practical |
| Backend business logic | Unit or service tests for success and failure paths |
| API contract change | Backend tests plus frontend/client impact check |
| Auth/authorization/security | Negative tests, IDOR checks, validation tests, security checklist |
| Data migration | Migration apply check, backward/rollback note, data-shape test when practical |
| Infrastructure/deploy | `docker compose config`, Terraform fmt/validate/plan, smoke test path |

### Coverage Standard

The repo aims for production-grade coverage:

- 95% or higher for line/statement/function coverage where supported
- branch coverage tracked separately
- branch coverage raised selectively for critical logic such as auth,
  authorization, validation, rate limits, data mutation, and security checks
- no tests added only to inflate a number without asserting behavior

Some languages and tools do not expose the same coverage categories. The
control is the strongest meaningful metric per stack, documented in the PR.

## Secure SDLC Requirements

Every PR should consider the security checklist in `.github/pull_request_template.md`.
Changes in these areas require extra care:

- auth, MFA, password reset, refresh tokens, session handling
- resource ownership and membership checks
- file uploads, image processing, generated media
- notification, friendship, trip, or spot mutations
- external HTTP calls and provider integrations
- raw SQL, migrations, or background jobs
- user-generated content rendered in the browser
- secrets, environment variables, and deployment config

Security controls are also documented in `SECURITY.md`.

## Release Gates

A release candidate should not be approved until:

- CI is green for affected services
- security scans have no untriaged high/critical findings
- docs and runbooks match the shipped behavior
- Docker Compose configuration renders
- Terraform plan has been reviewed when infrastructure changes are included
- migrations and seed data are compatible with the target environment
- rollback notes are documented
- post-deploy smoke checks are ready

Release and rollback details live in `docs/RELEASE-RUNBOOK.md`.

## Operations Feedback Loop

After release:

- run health and smoke checks
- inspect logs for startup errors or crash loops
- watch metrics and alerts
- document incidents or regressions
- convert follow-up work into tracked issues or milestone tasks

Production hardening expectations live in `docs/PRODUCTION-HARDENING.md`.

## External Governance Still Required

Some SDLC controls cannot be fully encoded in this repository. They must be
configured in GitHub or the deployment platform:

- branch protection for `main`
- required CI checks
- required reviewer approval
- CODEOWNERS enforcement
- Dependabot alert triage
- environment approvals for production deploys
- secret manager and IAM/OIDC configuration
- staging deployment validation before production promotion

The repo provides the process and automation hooks; the hosting platform must
enforce them.
