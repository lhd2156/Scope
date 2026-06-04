# Contributing to Scope

Thanks for contributing to Scope.

This repository is a multi-service system with shared integration infrastructure, so changes should be made deliberately and verified carefully.

## Core rules

### 1. Respect service boundaries

Do not blur service ownership.

- `Scope.Core/` owns auth, users, friendships, notifications, live sessions
- `scope_content/` owns spots, trips, photos, reviews, feed
- `scope_intel/` owns itinerary/recommendation/vibe logic
- `scope-rag/` owns retrieval and Scope AI chat grounding
- `scope-frontend/` owns the UI and browser-side integration logic
- `scope-admin/` owns the operational/admin UI
- `scope-site/` owns the public web surface
- `scope-metrics/` owns metrics probes, exporters, and alert rules
- `scope-cli/` owns operator CLI workflows
- `scope_geo/` owns geospatial primitives and bindings
- `scope_media/` owns image/media processing helpers

Avoid cross-service shortcuts that bypass documented boundaries.

### 2. Follow current code and active docs

The running code, tests, and active docs are the source of truth. If behavior, contracts, or schemas are ambiguous, verify them against the service implementation before coding.

### 3. Follow the SDLC

Use `docs/SDLC.md` for the repository SDLC policy and
`docs/SDLC-CONTROLS.md` for the evidence checklist. Every non-trivial change
should be clear about requirement, service ownership, design/contract impact,
verification, security risk, release notes, and rollback expectations.

Small fixes can capture this in the PR template. Larger cross-service work
should include a short design note in the PR or under `docs/`.

### 4. Use Conventional Commits

Format:

```text
type(scope): short description
```

Examples:

- `feat(core): align endpoint surface with architecture`
- `test(integration): add critical flow playwright smoke`
- `docs(integration): add deployment runbook`

### 5. Validate before you commit

Run the relevant build/tests for the area you changed.

#### Core

```powershell
cd Scope.Core
dotnet build Scope.Core.sln
dotnet test Scope.Core.sln
```

#### Content

```powershell
cd scope_content
python manage.py check
python -m pytest
```

#### Intel

```powershell
cd scope_intel
python -m pytest tests
```

#### RAG

```powershell
cd scope-rag
python -m pytest tests
```

#### Frontend

```powershell
cd scope-frontend
npm run build
npm run test
```

#### Frontend E2E

```powershell
cd scope-frontend
npm run test:e2e -- --project=chromium
```

#### Admin

```powershell
cd scope-admin
npm run build
npm run test
```

#### Site

```powershell
cd scope-site
npm run build
npm run test
```

#### Metrics Agent

```powershell
cd scope-metrics
go test ./...
go build ./cmd/scope-metrics
```

#### CLI Toolkit

```powershell
cd scope-cli
cargo test
```

#### Geo

```powershell
cd scope_geo
cmake -S . -B build
cmake --build build
ctest --test-dir build
python -m pytest tests
```

#### Media

```powershell
cd scope_media
python -m pytest tests
```

## Development workflow

### Branching

Feature branches used in this repo include:

- `feature/core-platform`
- `feature/content-engine`
- `feature/intel-api`
- `feature/frontend`

Lead-owned integration/documentation work may happen on the main workspace branch when coordinating the full system.

### PowerShell note

The primary workstation uses PowerShell.

Use:

```powershell
git add . ; git commit -m "message"
```

Do not assume `&&` chaining is available.

### Keep commits scoped

If the workspace already contains unrelated dirty files, stage only the files that belong to your current milestone.

## Code-quality expectations

- no dead code
- no placeholder TODO/FIXME/XXX markers in shipped changes
- no hardcoded secrets
- no ad-hoc fallback secrets in config
- prefer named constants over magic values
- keep API contracts aligned with implementation, tests, and active API docs
- add or update tests when behavior changes

## Security expectations

Security work is mandatory, not optional.

When touching auth, APIs, forms, or persistence, consider:

- JWT handling
- rate limiting
- input validation
- CORS policy
- safe error envelopes
- SQL/ORM safety
- XSS-safe rendering and sanitized display paths
- secure browser storage behavior

## Infrastructure + integration expectations

If you touch integration files, keep the repo-wide flow coherent across:

- `docker-compose.yml`
- `nginx/nginx.conf`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `k8s/`
- `terraform/`
- `scripts/sql/`
- `docs/DEPLOYMENT.md`

## Before opening a PR

Make sure you have:

- [ ] kept the change within the correct service boundary
- [ ] filled out the SDLC summary in the PR template
- [ ] verified behavior against the current code and active docs
- [ ] run the relevant build/tests
- [ ] included coverage evidence when code behavior changed
- [ ] updated docs if behavior or operations changed
- [ ] used a Conventional Commit
- [ ] staged only task-specific files

## Helpful references

- `README.md`
- `SECURITY.md`
- `docs/SDLC.md`
- `docs/SDLC-CONTROLS.md`
- `docs/API-REFERENCE.md`
- `docs/DEPLOYMENT.md`
- `scripts/sql/README.md`
- `terraform/README.md`
