# Scope Production Hardening Guide

This guide documents the production-facing hardening work that still sits beyond the local/staging deployment runbook.

Use this alongside:

- `docs/DEPLOYMENT.md`
- `docs/RELEASE-RUNBOOK.md`
- `terraform/README.md`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

## Scope

This document focuses on the production-readiness concerns that are **not** solved simply by having Docker Compose, CI, SQL seed data, Kubernetes manifests, and Terraform files in the repo.

It covers:

- secret management
- runtime environment hardening
- network and access control
- database/storage hardening
- image and deployment hygiene
- observability and incident readiness
- release validation

---

## 1. Secrets and configuration

### Never ship development defaults

Before any real deployment, replace all development/example values for:

- `CORE_JWT_SECRET`
- `DJANGO_SECRET_KEY`
- `FLASK_SECRET_KEY`
- SQL Server passwords
- AWS credentials
- Cognito/client settings
- S3 bucket names
- any fallback/demo tokens used for local workflows

### Preferred secret storage

Use a managed secret store rather than plain `.env` files in shared environments.

Recommended options:

- AWS Secrets Manager
- AWS Systems Manager Parameter Store
- Kubernetes Secrets backed by encrypted secret material
- GitHub Actions encrypted secrets for CI/CD-only values

### Rotation expectations

At minimum, define rotation policy for:

- JWT signing secret
- database credentials
- AWS IAM credentials (if any long-lived keys still exist)
- Cognito app secrets if introduced later

---

## 2. Identity and access

### Application auth

Production should enforce:

- strong JWT secret management
- issuer/audience validation everywhere
- short-lived access tokens
- refresh flow bounded by secure cookie/session policy
- no local mock-auth fallback in production frontend builds

### Cloud auth

Prefer short-lived federated credentials over static keys.

For AWS:

- use GitHub OIDC or a comparable workload-identity flow for deploy automation
- avoid long-lived IAM user access keys for CI/CD
- scope IAM permissions by service purpose, not by convenience

---

## 3. Network hardening

### Public exposure

Only the edge/load-balancer layer should be internet-facing.

Keep private:

- SQL Server
- Kafka/Zookeeper
- internal app service ports
- Kubernetes control-plane access except where explicitly required

### Expected topology

- public ingress/load balancer in front of Nginx or ingress controller
- application services on private subnets
- data stores on private subnets
- restricted security groups between service layers

### TLS

Production requires HTTPS termination with managed certificates.

Recommended:

- AWS ACM certificates
- ALB / ingress TLS termination
- HSTS on the public edge

---

## 4. Database hardening

### SQL Server

For RDS SQL Server or equivalent:

- enable automated backups
- set retention according to recovery requirements
- enable storage encryption
- keep the instance private
- restrict inbound access to app subnets/security groups only
- define restore testing cadence, not just backup creation

### Data lifecycle

Document retention/cleanup policy for:

- refresh tokens / auth artifacts
- live sessions
- notifications
- generated itinerary cache rows
- user-uploaded media references

---

## 5. Object storage hardening

### S3 bucket expectations

- block public access at the bucket level
- enable versioning
- use least-privilege bucket policies
- store uploads behind signed URLs or controlled CDN access
- define lifecycle rules for stale/temp uploads if needed

### Upload path validation

Production should ensure:

- server-side validation of allowed content types
- file-size limits
- image-processing safeguards
- metadata stripping or normalization where applicable

---

## 6. Container and image hygiene

### Build pipeline expectations

- multi-stage Dockerfiles only
- no build tools in final runtime image unless required
- pin important dependency versions intentionally
- scan images in the registry on push
- publish immutable image references for releases

### Runtime expectations

Where possible:

- run as non-root users
- set explicit health checks
- use read-only root filesystems where practical
- define CPU/memory limits in Kubernetes manifests

---

## 7. Kubernetes hardening

The repository already includes baseline manifests, but production rollout should additionally verify:

- resource requests/limits for every workload
- readiness + liveness probes are meaningful
- secret material is not stored in example manifests
- ingress rules are locked to intended hosts
- PodDisruptionBudgets / rollout strategy are appropriate for service criticality
- network policies exist if the cluster environment supports them

---

## 8. Terraform validation and promotion

The repo now contains a Terraform baseline, but production use should follow a real validation sequence:

1. `terraform fmt -check`
2. `terraform init`
3. `terraform validate`
4. `terraform plan` against a real AWS account
5. human review of plan output
6. controlled `terraform apply`
7. post-apply verification of created resources

### Minimum post-plan checks

Verify:

- VPC CIDRs do not overlap existing environments
- subnets map to the intended AZs
- SQL Server is private-only
- EKS node counts and instance types are cost-appropriate
- S3 bucket name is globally unique
- Cognito domain prefix is unique
- ECR repository names match deploy workflow expectations

---

## 9. Observability and operations

### Logging

Production should centralize logs from:

- Core API
- Content API
- Intel API
- Nginx / ingress
- Kubernetes events

Recommended minimum behavior:

- structured JSON logs
- request correlation IDs
- error-level alerting
- retention policy defined by environment

### Metrics and alerting

At minimum, alert on:

- service crash loops
- API 5xx spikes
- failed deploy workflow runs
- database connectivity failures
- Kafka connectivity failures
- unusually slow frontend/API smoke tests

### Smoke checks after deploy

Run at least:

- Compose/Kubernetes health verification
- frontend build smoke
- backend test spot checks as applicable
- Playwright critical-flow smoke test

---

## 10. Release checklist

Before calling Scope production-ready, verify:

- [ ] CI is green
- [ ] deploy workflow is green
- [ ] container images are published to GHCR
- [ ] Terraform baseline has been runtime-validated on a machine with Terraform installed
- [ ] secrets are managed outside local `.env` files
- [ ] public ingress is HTTPS-only
- [ ] DB backup/restore path is documented and tested
- [ ] observability/alerting is configured
- [ ] Playwright critical-flow smoke passes against the deployed environment
- [ ] rollback procedure is documented

---

## 11. Recommended next actions

The next concrete production-readiness steps are:

1. run `terraform plan` / `terraform validate` on a machine with Terraform installed
2. document the exact AWS/GitHub OIDC setup for deploy automation
3. add environment-specific secret-management guidance
4. define rollback and incident runbooks
5. validate Kubernetes manifests against a real cluster target
