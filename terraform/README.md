# Atlas Terraform baseline

This directory contains the first real Terraform baseline for Atlas.

## Files

- `main.tf` — provider config plus EKS, RDS SQL Server, S3, Cognito, and ECR resources
- `variables.tf` — configurable values and sensitive inputs
- `outputs.tf` — cluster, DB, bucket, repo, and Cognito outputs
- `vpc.tf` — VPC, subnets, NAT, and route tables
- `iam.tf` — IAM roles/policy attachments for EKS control plane + node group
- `backend.hcl.example` — template for the S3 backend configuration used after remote-state bootstrap
- `bootstrap/` — Terraform state bootstrap stack that creates the S3 state bucket + DynamoDB lock table

## Required input variables

At minimum, set:

- `sqlserver_master_password`
- `photos_bucket_name`
- `cognito_domain_prefix`

Example:

```powershell
terraform init -backend=false
terraform plan `
  -var="sqlserver_master_password=change-me" `
  -var="photos_bucket_name=atlas-photos-staging-example" `
  -var="cognito_domain_prefix=atlas-staging-example"
```

## Remote-state bootstrap

The main stack now includes an S3 backend definition. Bootstrap the remote-state resources first:

```powershell
terraform -chdir=terraform/bootstrap init
terraform -chdir=terraform/bootstrap apply
```

Then copy `terraform/backend.hcl.example` to `terraform/backend.hcl`, replace the placeholder values with the `backend_config` output from the bootstrap stack, and reinitialize the main stack:

```powershell
terraform init -reconfigure -backend-config=backend.hcl
```

## Current validation status

Local validation was run on 2026-04-19 with Terraform v1.14.8 on this workstation:

- `terraform init -backend=false` in `terraform/` ✅
- `terraform validate` in `terraform/` ✅
- `terraform init -backend=false` in `terraform/bootstrap/` ✅
- `terraform validate` in `terraform/bootstrap/` ✅
- `terraform plan ...` ⚠️ now requires the bootstrap state bucket + lock table to exist, a populated `terraform/backend.hcl`, and real AWS credentials before a dry-run can succeed locally

Provide the required variables plus AWS credentials to run a real plan:

```powershell
terraform plan `
  -var="sqlserver_master_password=change-me" `
  -var="photos_bucket_name=atlas-photos-staging-example" `
  -var="cognito_domain_prefix=atlas-staging-example"
```

What still remains unresolved is **runtime** validation against a real AWS account, including bootstrap apply, backend migration, credentials, networking, quotas, and globally unique naming constraints.

## GitHub Actions plan path

The repository deploy workflow now supports an optional manual Terraform plan job when these GitHub settings are configured:

- Variable: `AWS_ROLE_TO_ASSUME`
- Variable: `TF_AWS_REGION` (optional)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Secret: `TF_SQLSERVER_MASTER_PASSWORD`

Run the `Atlas Deploy` workflow with `run_terraform_plan = true` to execute a real-account `terraform plan` and upload the generated text output as an artifact.
