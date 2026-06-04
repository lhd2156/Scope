# Scope SDLC Controls Matrix

Use this matrix when preparing a pull request or release. It maps the SDLC
policy in `docs/SDLC.md` to concrete evidence a reviewer can check.

## Control Matrix

| Control area | Expected evidence | Repository support | Status |
|---|---|---|---|
| Requirements | Issue, task note, milestone, or PR SDLC summary explains the behavior change | Pull request template | Supported |
| Service ownership | Changed files match the owning service or explain cross-service impact | `CONTRIBUTING.md`, `docs/SDLC.md` | Supported |
| Design notes | API, schema, env var, migration, or architecture impact is documented | PR template, `docs/`, service docs | Supported |
| API contracts | Request/response behavior stays aligned with tests and docs | `docs/API-REFERENCE.md`, service tests | Supported |
| Code review | Reviewer can see summary, risk, verification, and rollout notes | `.github/pull_request_template.md` | Supported |
| Ownership enforcement | CODEOWNERS can route reviews to responsible owners | `.github/CODEOWNERS` | Repository-supported; enforcement is a GitHub setting |
| Branch protection | Required checks and reviewer approval protect mainline | GitHub branch settings | External platform control |
| Static analysis | CodeQL analyzes supported languages | `.github/workflows/` | CI-supported |
| Secret scanning | Secrets are scanned before merge | `.github/gitleaks.toml`, CI workflow | CI-supported |
| Dependency scanning | Vulnerable packages are checked per stack | Dependabot, audit commands, CI workflow | CI-supported |
| Container scanning | Images and filesystem artifacts are scanned | Trivy workflow steps | CI-supported |
| SBOM and signing | Release images include supply-chain evidence where configured | Deploy workflow, Trivy/CycloneDX, cosign steps | CI-supported |
| Unit and service tests | Affected services have behavior-focused tests | Service test suites | Supported |
| Integration and e2e tests | User-visible workflows have smoke or e2e coverage when practical | Playwright, service integration tests | Supported |
| Coverage | Line/statement/function coverage aims for 95%; branch coverage tracked separately | Coverage tooling per stack | Supported; CI gates should be expanded over time |
| Infrastructure validation | Compose, Kubernetes, and Terraform changes are validated | `docker-compose.yml`, `k8s/`, `terraform/` | Supported |
| Release readiness | Rollout, migration, rollback, and smoke notes are written before release | `docs/RELEASE-RUNBOOK.md` | Supported |
| Operations | Health checks, logs, metrics, and smoke tests confirm deployment health | `scripts/smoke-test.ps1`, metrics service | Supported |
| Incident/security response | Security reporting and response flow is documented | `SECURITY.md` | Supported |

## Service Validation Matrix

Run the rows that match the services changed by the pull request. For broad
platform changes, run every affected row and include the results in the PR.

| Area | Directory | Minimum validation |
|---|---|---|
| Core API | `Scope.Core/` | `dotnet build Scope.Core.sln`; `dotnet test Scope.Core.sln` |
| Content API | `scope_content/` | `python manage.py check`; `python -m pytest` |
| Intel API | `scope_intel/` | `python -m pytest tests` |
| RAG API | `scope-rag/` | `python -m pytest tests` |
| Frontend | `scope-frontend/` | `npm run build`; `npm run test`; relevant `npm run test:e2e` flow |
| Admin | `scope-admin/` | `npm run build`; `npm run test`; relevant `npm run test:e2e` flow |
| Site | `scope-site/` | `npm run build`; `npm run test`; relevant `npm run test:e2e` flow |
| Metrics Agent | `scope-metrics/` | `go test ./...`; `go build ./cmd/scope-metrics` |
| CLI Toolkit | `scope-cli/` | `cargo test` |
| Geo | `scope_geo/` | `cmake -S . -B build`; `cmake --build build`; `ctest --test-dir build`; `python -m pytest tests` when bindings are built |
| Media | `scope_media/` | `make test` or `python -m pytest tests` |
| Infrastructure | repo root | `docker compose config`; Terraform fmt/validate/plan when Terraform changes |

## Coverage Evidence

Coverage is considered professional when it proves behavior, not just lines.
For Scope, use this standard:

- aim for at least 95% line, statement, and function coverage where the stack
  reports those metrics
- track branch coverage separately and raise it for critical logic such as auth,
  authorization, validation, rate limits, migrations, data mutation, and security
  checks
- include coverage output or artifact links in the PR for services with code
  changes
- explain any uncovered risk area instead of adding hollow tests

## Release Readiness Checklist

Before a production-oriented push or release:

- [ ] PR summary states the requirement, impacted services, and user/operator impact.
- [ ] Tests match the risk of the change and are listed in the PR.
- [ ] Security checklist is complete and any new risk is explained.
- [ ] API docs, runbooks, env docs, migrations, and deployment assets are updated.
- [ ] Docker Compose config renders.
- [ ] Terraform plan is reviewed when infrastructure changed.
- [ ] Rollout and rollback notes are written.
- [ ] Post-deploy smoke checks are ready.

## Known Governance Gaps

These are normal external controls and should be configured before treating the
repository as production-governed:

- protect `main` with required checks
- require at least one approving review
- enable CODEOWNERS review enforcement
- require passing secret, dependency, static-analysis, and test checks
- require deployment environment approvals
- store production secrets in a secret manager
- validate staging before production promotion
- stage only intentional files from the current dirty workspace
