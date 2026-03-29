# Atlas Terraform baseline

This directory contains the first real Terraform baseline for Atlas.

## Files

- `main.tf` — provider config plus EKS, RDS SQL Server, S3, Cognito, and ECR resources
- `variables.tf` — configurable values and sensitive inputs
- `outputs.tf` — cluster, DB, bucket, repo, and Cognito outputs
- `vpc.tf` — VPC, subnets, NAT, and route tables
- `iam.tf` — IAM roles/policy attachments for EKS control plane + node group

## Required input variables

At minimum, set:

- `sqlserver_master_password`
- `photos_bucket_name`
- `cognito_domain_prefix`

Example:

```powershell
terraform init
terraform plan `
  -var="sqlserver_master_password=change-me" `
  -var="photos_bucket_name=atlas-photos-staging-example" `
  -var="cognito_domain_prefix=atlas-staging-example"
```

## Current validation status

The Terraform binary is not installed on the current heartbeat host, so this baseline was authored and reviewed as static IaC on this machine. The repository CI now performs:

- `terraform fmt -check -recursive`
- `terraform init -backend=false`
- `terraform validate`

What still remains unresolved is **runtime** validation against a real AWS account (`terraform plan` / apply-time verification with real credentials, networking, quotas, and naming constraints).

## GitHub Actions plan path

The repository deploy workflow now supports an optional manual Terraform plan job when these GitHub settings are configured:

- Variable: `AWS_ROLE_TO_ASSUME`
- Variable: `TF_AWS_REGION` (optional)
- Variable: `TF_PHOTOS_BUCKET_NAME`
- Variable: `TF_COGNITO_DOMAIN_PREFIX`
- Secret: `TF_SQLSERVER_MASTER_PASSWORD`

Run the `Atlas Deploy` workflow with `run_terraform_plan = true` to execute a real-account `terraform plan` and upload the generated text output as an artifact.
