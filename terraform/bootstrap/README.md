# Terraform remote-state bootstrap

This directory creates the remote-state infrastructure used by the main `terraform/` stack:

- An encrypted, versioned S3 bucket for Terraform state
- A DynamoDB lock table for state locking

The generated S3 bucket name includes the AWS account ID (`<project>-<environment>-<account-id>-tfstate`) so it stays globally unique across accounts.

## Bootstrap flow

```powershell
terraform -chdir=terraform/bootstrap init
terraform -chdir=terraform/bootstrap apply
```

After the bootstrap apply finishes:

1. Copy `terraform/backend.hcl.example` to `terraform/backend.hcl`
2. Replace the placeholder values with the `backend_config` output from this bootstrap stack
3. Reinitialize the main Terraform stack:

```powershell
terraform -chdir=terraform init -reconfigure -backend-config=backend.hcl
```
