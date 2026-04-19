# Atlas Release & Rollback Runbook

This runbook describes how to prepare, deploy, verify, and roll back an Atlas release.

Use it alongside:

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION-HARDENING.md`
- `docs/API-REFERENCE.md`
- `terraform/README.md`

## Scope

This is the operational release guide for the repository as it exists today.

It assumes:

- app services are already buildable/testable
- CI and deploy workflows exist
- Kubernetes manifests and Terraform baseline are in repo
- deployment bundle artifacts can be produced

It does **not** assume that Terraform has already been executed against a real AWS account from this workstation.

---

## 1. Release prerequisites

Before a release candidate is approved:

- [ ] `main` contains the intended release commits only
- [ ] CI is green (`.github/workflows/ci.yml`)
- [ ] deploy automation is green or ready to run (`.github/workflows/deploy.yml`)
- [ ] Docker Compose config still renders successfully
- [ ] frontend critical-flow Playwright smoke is green
- [ ] SQL schema + seed assets match the current code expectations
- [ ] Terraform baseline has been reviewed for the target environment
- [ ] required secrets/config values exist in the target environment

### Required validation commands

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
npm run test:e2e -- --project=chromium
```

---

## 2. Versioning and release preparation

### Tagging strategy

Use a semantic version tag for release candidates and final releases.

Examples:

- `v0.9.0-rc.1`
- `v1.0.0`

### Recommended pre-tag checklist

- [ ] update any release notes / milestone summary
- [ ] confirm README/deployment docs still match the repo
- [ ] confirm no temporary debug logging or fallback secrets exist
- [ ] confirm all release-critical commits are pushed

### Create a tag

```powershell
git tag v1.0.0
git push origin v1.0.0
```

If you prefer annotated tags:

```powershell
git tag -a v1.0.0 -m "Atlas v1.0.0"
git push origin v1.0.0
```

---

## 3. Deployment path

### Option A — current repository automation path

1. merge the release candidate to `main`
2. allow `.github/workflows/deploy.yml` to run on `main`
3. verify that:
   - preflight passes
   - GHCR images publish successfully
   - deployment bundle artifact uploads successfully
4. when infrastructure changes are included, dispatch `Atlas Deploy` manually with `terraform_action = plan`, review the uploaded plan artifact, then rerun with `terraform_action = apply` after approval
5. promote/deploy from the generated image set and bundle

### Option B — manual deployment path

Use when automation is unavailable or when performing a controlled staging rollout.

1. generate/collect the deployment bundle
2. deploy the desired images/config to the target environment
3. apply or update infra where required
4. run post-deploy verification checks

---

## 4. Post-deploy verification

### Minimum checks

- [ ] public app loads through the edge route
- [ ] Core auth endpoints respond as expected
- [ ] Content read paths work
- [ ] Intel recommendation/health endpoints respond
- [ ] Playwright critical-flow smoke passes against the deployed target if feasible
- [ ] logs show no immediate crash loops or startup failures

### Recommended spot checks

- register / login
- map loads and route shell renders
- create/view a spot
- plan a trip
- check notifications/friends surfaces
- verify Intel health route returns the expected bare health JSON shape

---

## 5. Rollback strategy

### Image rollback

If a deployment fails after new images are released:

1. identify the last known-good image tags
2. redeploy Core, Content, Intel, and/or Frontend to those tags
3. re-run post-deploy verification

### Config rollback

If the issue is configuration-based:

1. restore the last known-good env/secret set
2. restore any related edge/ingress config
3. redeploy the affected service(s)
4. verify the health/smoke checks again

### Database caution

Do **not** treat DB rollback casually.

Before any schema-affecting release:

- ensure backups exist
- confirm restore procedure is documented
- avoid destructive/manual rollback steps without backup validation

---

## 6. Incident response starter checklist

If production breaks immediately after release:

- [ ] freeze further deploys
- [ ] identify whether the failure is code, config, infra, or data
- [ ] capture failing logs and exact timestamps
- [ ] decide between fast rollback and forward-fix
- [ ] communicate affected surface area (Core / Content / Intel / Frontend)
- [ ] re-run smoke checks after mitigation
- [ ] document root cause and follow-up work

---

## 7. Current release blockers still outside this runbook

These are the major remaining runtime gaps for Atlas:

1. execute the Terraform workflow against a real AWS account
2. validate the Kubernetes/Terraform stack in a live cloud target
3. finalize environment-specific production secrets and IAM/OIDC setup
4. complete final release polish around live cloud verification

---

## 8. Recommended next steps

1. run the deploy workflow's Terraform plan/apply path against a real AWS account using the target GitHub environment vars/secrets
2. verify deploy workflow secrets/vars and environment approvals for the target GitHub environment
3. perform a real staging deployment using the published GHCR images and deployment bundle
4. tag the first release candidate only after that staging verification succeeds
