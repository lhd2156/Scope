# Scope Terraform baseline

This directory now supports three distinct deployment profiles:

- `credit-saver`: the default staging profile. It creates only the low-cost shared AWS building blocks you can keep around while credits are limited:
  - VPC and subnets
  - S3 photos bucket
  - Cognito user pool, app client, and hosted UI domain
- `lightsail`: the always-on single-box profile. It keeps the shared foundation above and adds:
  - 1 Amazon Lightsail instance
  - 1 static public IP
  - daily automatic snapshots
  - public ports for SSH, HTTP, and HTTPS
- `full`: the original heavier stack. It adds the high-burn resources:
  - NAT gateway + public IPv4
  - RDS SQL Server Express
  - EKS cluster + managed node group
  - optional ECR repositories

The current GitHub Actions image publishing path already uses GHCR, so both `credit-saver` and `lightsail` avoid paying for idle ECR repositories unless you explicitly switch to the `full` EKS profile.

## Files

- `main.tf` - provider config plus S3, Cognito, optional EKS, optional RDS, and optional ECR resources
- `lightsail.tf` - optional Lightsail instance, static IP, bootstrap user data, and public port rules
- `variables.tf` - configurable values and profile controls
- `outputs.tf` - VPC, bucket, auth, and optional compute/database outputs
- `vpc.tf` - VPC, subnets, optional NAT, and route tables
- `iam.tf` - IAM roles and policy attachments for the optional EKS control plane + node group
- `backend.hcl.example` - template for the S3 backend configuration used after remote-state bootstrap
- `bootstrap/` - Terraform state bootstrap stack that creates the S3 state bucket + DynamoDB lock table

## Key variables

- `stack_profile`
  - `credit-saver` (default): keeps the monthly burn very low
  - `lightsail`: provisions the always-on 8 GB Lightsail runtime path
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
- optional `lightsail_*` overrides if you want a non-default bundle, AZ, or SSH allowlist

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

Then copy `terraform/backend.hcl.example` to `terraform/backend.hcl`, replace the placeholder values with the `backend_config` output from the bootstrap stack, and reinitialize the main stack:

```powershell
terraform init -reconfigure -backend-config=backend.hcl
```

## Cheap staging recommendation

If the goal is to stretch AWS credits for several months, keep `stack_profile=credit-saver` for staging and continue using:

- local Docker Compose for day-to-day development
- GitHub Actions for CI and image builds
- GHCR for container images

That keeps always-on AWS spend close to S3/Cognito usage rather than paying the fixed hourly baseline from EKS, NAT, and RDS.

If the goal is an always-on Scope box without jumping to EKS, use `stack_profile=lightsail`. That path provisions the shared S3/Cognito foundation plus a Lightsail instance that is bootstrapped with Docker, Docker Compose, curl, and a prepared `/opt/scope` directory tree.

When the deploy workflow is run with:

- `terraform_action = apply`
- `terraform_profile = lightsail`
- `deploy_lightsail_app = true`

the workflow will:

- query the Terraform outputs for the Lightsail host
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
- Variable: `TF_STATE_LOCK_TABLE`
- Variable: `TF_STATE_KEY` (optional, defaults to `foundation/<environment>/terraform.tfstate`)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Secret: `TF_SQLSERVER_MASTER_PASSWORD` only needed when `terraform_profile=full`
- Secret: `LIGHTSAIL_SSH_PRIVATE_KEY` when `deploy_lightsail_app=true`
- Variable: `LIGHTSAIL_KEY_PAIR_NAME` when `terraform_profile=lightsail`
- Variable: `LIGHTSAIL_SSH_PUBLIC_KEY` when `terraform_profile=lightsail`
- Secret: `SCOPE_SA_PASSWORD` when `deploy_lightsail_app=true`
- Secret: `SCOPE_CORE_JWT_SECRET` when `deploy_lightsail_app=true`
- Secret: `SCOPE_DJANGO_SECRET_KEY` when `deploy_lightsail_app=true`
- Secret: `SCOPE_FLASK_SECRET_KEY` when `deploy_lightsail_app=true`
- Variable: `VITE_MAPBOX_TOKEN` when `deploy_lightsail_app=true`
- Variable: `SCOPE_PUBLIC_BASE_URL` (optional; defaults to `https://<lightsail-public-ip>`)
- Variable: `SCOPE_TLS_HOSTNAME` (optional; defaults to the public host)

Run the `Scope Deploy` workflow with:

- `terraform_action = plan` to execute a real-account `terraform plan`
- `terraform_action = apply` to generate the plan artifact and then apply it
- `terraform_profile = credit-saver` for the low-cost default
- `terraform_profile = lightsail` for the always-on single-box Scope runtime
- `terraform_profile = full` only when you explicitly want EKS, NAT, and RDS created
- `terraform_registry = ghcr` to skip ECR
- `terraform_registry = ecr` only when you want AWS-hosted image repositories
- `deploy_lightsail_app = true` to upload the Scope runtime bundle to the Lightsail host right after apply
