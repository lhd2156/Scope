# Scope Trips Production Certification - Phase 3 Evidence

Date: 2026-06-11

## Phase 3 Goal

Make the production API header fix durable without broadening into full certification.

## Phase Count

Use six bounded phases for this certification track:

1. Baseline, Rust SQL seed, inventory, local smoke
2. Production API header gate
3. Durable deploy alignment for the API header fix
4. Automated build/test/coverage gates by codebase
5. Browser UX, accessibility, responsive, and persistence journeys
6. Security, infrastructure, recovery, rollback, and final production evidence

## Completed Evidence

- Production smoke was still green at the start of Phase 3.
- The production Nginx hotfix from Phase 2 was restart-tested through AWS SSM with only the `nginx` service restarted.
- After restart, the production origin returned exactly one `Strict-Transport-Security` header and one `Content-Security-Policy` header for Core, Content, and Intel health paths.
- Production smoke passed again after the Nginx restart:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl https://scopetrips.com `
  -MetricsHealthUrl https://scopetrips.com/api/metrics/health `
  -SkipMetricsScrape `
  -TimeoutSeconds 20
```

Result:

```text
Passed: 6/6
All Scope smoke checks passed.
```

## Repo Durability Changes

- Added CI enforcement that `nginx/nginx.conf` must hide upstream security headers before applying the edge policy.
- Added deploy preflight enforcement for the same Nginx header normalization contract.
- Added a workflow app-only compose redeploy path: `deploy_lightsail_app=true` with `terraform_action=skip` can redeploy the runtime bundle from existing Terraform state instead of requiring a Terraform apply just to refresh app or Nginx code.
- Updated deployment/release docs to describe the app-only compose redeploy path.
- Corrected Phase 1 evidence so it no longer claims a Worker deploy that the active Wrangler token cannot currently perform.

## Validation

- `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` parse as YAML.
- Local Nginx header contract check passed.
- `scripts/production-preflight.ps1 -Environment production -TerraformProfile ec2-compose -DeployComposeHost -AllowDirtyWorktree` passed required checks.
- `git diff --check` passed for the Phase 3 touched files.
- Production smoke passed 6/6 after the Nginx restart.

## Residual Risk

Production is still serving the old runtime release directory `296c5bba09cb6facef0634be413cd73269c29884`, with the Nginx header fix persisted in the mounted config file. That fix survives Nginx restart and future current-main deploys have guardrails, but a full current-main app/runtime redeploy was not executed in Phase 3 because it restarts more than the API edge gate.

Cloudflare Worker deployment still requires a Wrangler token with Worker script and route write permissions.

## Next Bounded Phase Goal

Phase 4: Run automated build/test/coverage gates by codebase without broad UX/security expansion. Use the existing dirty worktree as-is, do not revert unrelated changes, run the narrowest meaningful test/build suites for Core, Content, Intel, frontend, site/admin, metrics, Rust CLI, and deployment config, fix only validated release-blocking failures, and document pass/fail evidence plus blockers. Do not start browser journey certification until Phase 4 has a concrete automated-gate result.
