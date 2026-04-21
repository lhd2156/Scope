# Contributing to Atlas

Thanks for contributing to Atlas.

This repository is a multi-service system with shared integration infrastructure, so changes should be made deliberately and verified carefully.

## Core rules

### 1. Respect service boundaries

Do not blur service ownership.

- `Atlas.Core/` owns auth, users, friendships, notifications, live sessions
- `atlas_content/` owns spots, trips, photos, reviews, feed
- `atlas_intel/` owns itinerary/recommendation/vibe logic
- `atlas-frontend/` owns the UI and browser-side integration logic

Avoid cross-service shortcuts that bypass documented boundaries.

### 2. Follow the architecture

The architecture source of truth is:

- `atlas_architecture.tex`

If behavior, contracts, or schemas are ambiguous, resolve the question against the architecture before coding.

### 3. Use Conventional Commits

Format:

```text
type(scope): short description
```

Examples:

- `feat(core): align endpoint surface with architecture`
- `test(integration): add critical flow playwright smoke`
- `docs(integration): add deployment runbook`

### 4. Validate before you commit

Run the relevant build/tests for the area you changed.

#### Core

```powershell
cd Atlas.Core
dotnet build Atlas.Core.sln
dotnet test Atlas.Core.sln
```

#### Content

```powershell
cd atlas_content
python manage.py check
python -m pytest
```

#### Intel

```powershell
cd atlas_intel
python -m pytest tests
```

#### Frontend

```powershell
cd atlas-frontend
npm run build
npm run test
```

#### Frontend E2E

```powershell
cd atlas-frontend
npm run test:e2e -- --project=chromium
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
- keep API contracts aligned with the architecture and tests
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
- [ ] followed `atlas_architecture.tex`
- [ ] run the relevant build/tests
- [ ] updated docs if behavior or operations changed
- [ ] used a Conventional Commit
- [ ] staged only task-specific files

## Helpful references

- `README.md`
- `docs/DEPLOYMENT.md`
- `scripts/sql/README.md`
- `terraform/README.md`
- `AGENTS.md`
- `SOUL.md`
- `USER.md`
