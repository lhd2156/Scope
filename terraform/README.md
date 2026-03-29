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

The Terraform binary is not installed on the current heartbeat host, so this baseline was authored as static IaC and reviewed for consistency with the existing Kubernetes/docker-compose topology, but it was **not** validated with `terraform fmt`, `terraform validate`, or `terraform plan` on this machine.
