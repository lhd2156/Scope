# Scope Terraform baseline

This directory now supports four distinct deployment profiles:

- `credit-saver`: the default staging profile. It creates only the low-cost shared AWS building blocks you can keep around while credits are limited:
  - VPC and subnets
  - S3 photos bucket
  - Cognito user pool, app client, and hosted UI domain
- `lightsail`: the always-on single-box profile. It keeps the shared foundation above and adds:
  - 1 Amazon Lightsail instance
  - 1 static public IP
  - daily automatic snapshots
  - public ports for HTTP and HTTPS
  - SSH only when `lightsail_admin_ipv4_cidrs` or `lightsail_admin_ipv6_cidrs` is explicitly set
- `ec2-compose`: the Terraform-managed single-box fallback if the account remains blocked from the target Lightsail bundle. It keeps the shared foundation above and adds:
  - 1 EC2 instance in the public subnet
  - Amazon Linux 2023 bootstrap for Docker + Compose
  - encrypted gp3 root storage
  - daily AWS DLM root-volume snapshots, enabled by default
  - optional Elastic IP, disabled by default to avoid extra idle resources
  - public ports for HTTP and HTTPS
  - SSH only when `ec2_compose_admin_ipv4_cidrs` is explicitly set
- `full`: the original heavier stack. It adds the high-burn resources:
  - NAT gateway + public IPv4
  - RDS SQL Server Express
  - EKS cluster + managed node group
  - optional ECR repositories

The current GitHub Actions image publishing path already uses GHCR, so `credit-saver`, `lightsail`, and `ec2-compose` avoid paying for idle ECR repositories unless you explicitly switch to the `full` EKS profile.

## Files

- `main.tf` - provider config plus S3, Cognito, optional EKS, optional RDS, and optional ECR resources
- `credit-guard.tf` - credit-window preconditions and optional AWS Budget resource
- `lightsail.tf` - optional Lightsail instance, static IP, bootstrap user data, and public port rules
- `ec2-compose.tf` - optional EC2 single-host Compose fallback
- `variables.tf` - configurable values and profile controls
- `outputs.tf` - VPC, bucket, auth, and optional compute/database outputs
- `vpc.tf` - VPC, subnets, optional NAT, and route tables
- `iam.tf` - IAM roles and policy attachments for the optional EKS control plane + node group
- `backend.hcl.example` - template for the S3 backend configuration used after remote-state bootstrap
- `bootstrap/` - Terraform state bootstrap stack that creates the S3 state bucket plus a legacy DynamoDB lock table for older backend configs

## Key variables

- `stack_profile`
  - `credit-saver` (default): keeps the monthly burn very low
  - `lightsail`: provisions the approved medium Lightsail runtime path
  - `ec2-compose`: provisions the lower-cost EC2 Compose fallback while Lightsail quota approval is pending
  - `full`: provisions the original EKS + RDS stack
- `container_registry`
  - `ghcr` (default): do not create ECR repositories
  - `ecr`: create ECR repositories when `stack_profile=full`

## Required input variables

For `credit-saver`:

- `photos_bucket_name`
- `cognito_domain_prefix`

For `lightsail`:

- `photos_bucket_name`
- `cognito_domain_prefix`
- `lightsail_key_pair_name`
- `lightsail_public_key`
- `lightsail_admin_ipv4_cidrs` or `lightsail_admin_ipv6_cidrs` when remote SSH deployment is needed
- optional `lightsail_*` overrides if you want a non-default bundle, AZ, swap size, or SSH allowlist

For `ec2-compose`:

- `photos_bucket_name`
- `cognito_domain_prefix`
- `ec2_compose_key_pair_name`
- `ec2_compose_public_key`
- optional `ec2_compose_*` overrides for AMI, instance size, disk, swap, SSH allowlist, and Elastic IP behavior
- optional EC2 root-volume backup controls:
  - `ec2_compose_enable_root_snapshots` defaults to `true`
  - `ec2_compose_snapshot_time_utc` defaults to `07:00`
  - `ec2_compose_snapshot_retain_count` defaults to `3`

For `full`:

- `photos_bucket_name`
- `cognito_domain_prefix`
- `sqlserver_master_password`

Examples:

```powershell
terraform init -backend=false
terraform plan `
  -var="photos_bucket_name=scope-photos-staging-example" `
  -var="cognito_domain_prefix=scope-staging-example"
```

```powershell
terraform init -backend=false
terraform plan `
  -var="stack_profile=lightsail" `
  -var="photos_bucket_name=scope-photos-staging-example" `
  -var="cognito_domain_prefix=scope-staging-example"
```

```powershell
terraform init -backend=false
terraform plan `
  -var="stack_profile=ec2-compose" `
  -var="photos_bucket_name=scope-photos-staging-example" `
  -var="cognito_domain_prefix=scope-staging-example"
```

```powershell
terraform init -backend=false
terraform plan `
  -var="stack_profile=full" `
  -var="container_registry=ecr" `
  -var="sqlserver_master_password=change-me-to-a-long-random-secret" `
  -var="photos_bucket_name=scope-photos-staging-example" `
  -var="cognito_domain_prefix=scope-staging-example"
```

## Remote-state bootstrap

The main stack includes an S3 backend definition. Bootstrap the remote-state resources first:

```powershell
terraform -chdir=terraform/bootstrap init
terraform -chdir=terraform/bootstrap apply
```

Then copy `terraform/backend.hcl.example` to `terraform/backend.hcl`, replace the placeholder values with the `backend_config` output from the bootstrap stack, and reinitialize the main stack. Current backend config uses S3 `use_lockfile = true`; `legacy_backend_config` is available if an older Terraform workflow still needs DynamoDB locking.

```powershell
terraform init -reconfigure -backend-config=backend.hcl
```

## Cheap staging recommendation

If the goal is to stretch AWS credits for several months, keep `stack_profile=credit-saver` for staging and continue using:

- local Docker Compose for day-to-day development
- GitHub Actions for CI and image builds
- GHCR for container images

That keeps always-on AWS spend close to S3/Cognito usage rather than paying the fixed hourly baseline from EKS, NAT, and RDS.

If the goal is an always-on Scope box without jumping to EKS, use `stack_profile=lightsail` first. That path provisions the shared S3/Cognito foundation plus the approved `medium_3_0` Lightsail instance, pinned Docker Compose/Buildx bootstrap tooling, swap headroom, and a prepared `/opt/scope` directory tree.

If the AWS account later gets approved for `large_3_0`, set `LIGHTSAIL_BUNDLE_ID=large_3_0` and raise `LIGHTSAIL_MONTHLY_ESTIMATE_USD` so the credit guard remains accurate. If Lightsail itself remains blocked, use `stack_profile=ec2-compose` as the Terraform-managed fallback. Its default `t3a.medium` + 80 GiB gp3 shape is intentionally lower-cost than comparable 8 GB EC2, but it is a compromise versus the larger Lightsail target and relies on swap for bursty local SQL Server / app startup pressure.

The `lightsail` profile also attaches a 160 GiB Lightsail block storage disk by default. The remote deploy script formats and mounts it at `/opt/scope/shared`, then writes a production-only Compose override so SQL Server, Content media, Intel data, RAG data, and Ollama data land on that disk instead of competing with release bundles on the root volume. Lightsail block storage is priced separately from the instance at about `$0.10/GB-month`, so the default disk adds about `$16/mo`.

The credit guard defaults encode the current target from June 3, 2026 through September 24, 2026:

- credit ceiling: `$190`
- runtime window: `113` days
- expiry date: `2026-09-24` UTC
- estimated `lightsail` runtime cost on `medium_3_0` plus the 160 GiB data disk: about `$150.67`
- estimated `ec2-compose` runtime cost: about `$141.25`
- estimated `ec2-compose` monthly profile cost: about `$37.50`

Terraform refuses guarded applies after the expiry date or when the selected profile estimate exceeds the configured ceiling. The optional AWS Budget is created by default for the main stack, but budget alerts are not a hard spending stop; keep the existing AWS account-level budget/teardown controls active too.

The EC2 Compose fallback includes a DLM policy for daily root-volume snapshots with three-snapshot retention by default. This gives the single-host runtime a minimal recovery path for Docker volumes and local SQL Server data stored on the root EBS volume; it is still not a substitute for multi-AZ databases or object-level backups in the `full` profile.

When the deploy workflow is run with:

- `terraform_action = apply`
- `terraform_profile = lightsail` or `ec2-compose`
- `deploy_lightsail_app = true`

the workflow will:

- query the Terraform outputs for the selected Compose host
- render a runtime `.env` from GitHub environment secrets/variables
- upload a source release bundle over SSH
- bootstrap the Core schema
- start the Scope Compose stack on the host
- verify the edge plus Core/Content/Intel health endpoints locally on the VM

## GitHub Actions plan / apply path

The deploy workflow supports optional manual Terraform plan and apply jobs when these GitHub environment or repository settings are configured:

- Variable: `AWS_ROLE_TO_ASSUME`
- Variable: `TF_AWS_REGION` (optional)
- Variable: `TF_STATE_BUCKET`
- Variable: `TF_STATE_LOCK_TABLE` (legacy only; current workflow uses S3 `use_lockfile`)
- Variable: `TF_STATE_KEY` (optional, defaults to `foundation/<environment>/terraform.tfstate`)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Variable: `ALLOW_FULL_PRODUCTION_INFRA=true` only when intentionally allowing the high-cost `full` profile in production
- Secret: `TF_SQLSERVER_MASTER_PASSWORD` only needed when `terraform_profile=full`
- Secret: `LIGHTSAIL_SSH_PRIVATE_KEY` when `deploy_lightsail_app=true`
- Variable: `LIGHTSAIL_KEY_PAIR_NAME` when `terraform_profile=lightsail`
- Variable: `LIGHTSAIL_SSH_PUBLIC_KEY` when `terraform_profile=lightsail`
- Variable: `LIGHTSAIL_DYNAMIC_RUNNER_SSH` (optional; defaults to `true`) to let the deploy job open SSH only to the current GitHub runner `/32` during deploy and close it afterward
- Variable: `LIGHTSAIL_ADMIN_IPV4_CIDRS` or `LIGHTSAIL_ADMIN_IPV6_CIDRS` when `terraform_profile=lightsail` and `deploy_lightsail_app=true` only if dynamic runner SSH is disabled; use an exact runner/VPN/admin CIDR, not `0.0.0.0/0` in production
- Variable: `LIGHTSAIL_BUNDLE_ID` (optional; defaults to `medium_3_0`)
- Variable: `LIGHTSAIL_MONTHLY_ESTIMATE_USD` (optional; defaults to `24`)
- Variable: `LIGHTSAIL_DATA_DISK_SIZE_GIB` (optional; defaults to `160`; set `0` to disable the attached data disk)
- Variables: `SQLSERVER_MEMORY_LIMIT_MB`, `OLLAMA_MEM_LIMIT`, `INTEL_MEM_LIMIT`, and `RAG_MEM_LIMIT` (optional medium-host runtime caps)
- Variable: `EC2_COMPOSE_KEY_PAIR_NAME` when `terraform_profile=ec2-compose` (falls back to `LIGHTSAIL_KEY_PAIR_NAME`)
- Variable: `EC2_COMPOSE_SSH_PUBLIC_KEY` when `terraform_profile=ec2-compose` (falls back to `LIGHTSAIL_SSH_PUBLIC_KEY`)
- Variable: `EC2_COMPOSE_ADMIN_IPV4_CIDRS` when `terraform_profile=ec2-compose` and `deploy_lightsail_app=true`; use an exact runner/VPN/admin CIDR
- Secret: `SCOPE_SA_PASSWORD` when `deploy_lightsail_app=true`
- Secret: `SCOPE_CORE_JWT_SECRET` when `deploy_lightsail_app=true`
- Secret: `SCOPE_GRPC_INTERNAL_TOKEN` or `GRPC_INTERNAL_TOKEN` when `deploy_lightsail_app=true` in production; use at least 32 random characters
- Secret: `SCOPE_DJANGO_SECRET_KEY` when `deploy_lightsail_app=true`
- Secret: `SCOPE_FLASK_SECRET_KEY` when `deploy_lightsail_app=true`
- Secrets: `SCOPE_AWS_ACCESS_KEY_ID` and `SCOPE_AWS_SECRET_ACCESS_KEY` when `terraform_profile=lightsail` and `deploy_lightsail_app=true`; use a scoped IAM user limited to the photos bucket because Lightsail cannot attach the EC2 instance profile used by `ec2-compose`
- Secret: `SCOPE_SENTRY_DSN` or `SENTRY_DSN` for production server-side Sentry coverage
- Secret: `SCOPE_CONTENT_SENTRY_DSN` or `CONTENT_SENTRY_DSN` when Content should use a separate Sentry project
- Secret: `COMPOSE_HOST_SSH_PRIVATE_KEY` when `deploy_lightsail_app=true` (falls back to `LIGHTSAIL_SSH_PRIVATE_KEY`)
- Variable: `VITE_MAPBOX_TOKEN` when `deploy_lightsail_app=true`
- Variable or secret: `VITE_SENTRY_DSN` for production browser-side Sentry coverage
- Variable: `SCOPE_PUBLIC_BASE_URL` (optional; defaults to `https://<compose-host-public-ip>`)
- Variable: `SCOPE_TLS_HOSTNAME` (optional; defaults to the public host)

For the current approved medium Lightsail path, keep `LIGHTSAIL_DYNAMIC_RUNNER_SSH=true` and leave `LIGHTSAIL_ADMIN_IPV4_CIDRS=[]` / `LIGHTSAIL_ADMIN_IPV6_CIDRS=[]`. Terraform then keeps SSH closed at rest; the deploy job temporarily opens port 22 to the active GitHub runner IP only. The medium profile uses an 8 GiB swap safety net, a 160 GiB data disk, and explicit SQL Server, Ollama, Intel, and RAG caps; it is the closest safe target while the account is blocked from `large_3_0`.

Production applies and Compose-host deploys must run from `main`. The high-cost `full` profile is blocked in production unless `ALLOW_FULL_PRODUCTION_INFRA=true` is set.

Before dispatching a production single-host plan/apply, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\production-preflight.ps1 -Environment production -TerraformProfile lightsail -DeployComposeHost
```

Use `-TerraformProfile ec2-compose -DeployComposeHost` for the EC2 fallback, or omit `-DeployComposeHost` when checking a Terraform-only foundation plan.

Run the `Scope Deploy` workflow with:

- `terraform_action = plan` to execute a real-account `terraform plan`
- `terraform_action = apply` to generate the plan artifact and then apply it
- `terraform_profile = credit-saver` for the low-cost default
- `terraform_profile = lightsail` for the always-on single-box Scope runtime
- `terraform_profile = ec2-compose` for the AWS EC2 fallback while Lightsail approval is pending
- `terraform_profile = full` only when you explicitly want EKS, NAT, and RDS created
- `terraform_registry = ghcr` to skip ECR
- `terraform_registry = ecr` only when you want AWS-hosted image repositories
- `deploy_lightsail_app = true` to upload the Scope runtime bundle to the selected Compose host right after apply

The production GitHub environment currently reserves an additional `$10/mo` with:

- `CREDIT_GUARD_ADDON_MONTHLY_USD=10`
- `CREDIT_GUARD_ADDON_NAME=edge-sweeper-reserve`

That makes the guarded medium Lightsail estimate `$188.34` for the 113-day window when the production `$10/mo` edge reserve is included, leaving about `$1.66` before the `$190` ceiling. The 160 GiB data disk consumes about `$60.27` of the window, which uses almost all of the remaining credit headroom on durable storage instead of idle reserve. A `large_3_0` Lightsail host at `$44/mo` would fit by itself (`$165.74`), but it leaves only about `$24.26` for every other AWS charge. With the `$10/mo` edge reserve, `large_3_0` would estimate at `$203.40`, so `medium_3_0` remains the right deployment target until the budget or quota changes.
