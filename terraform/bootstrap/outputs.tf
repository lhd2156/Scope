output "terraform_state_bucket_name" {
  description = "S3 bucket name that stores the Scope Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_lock_table_name" {
  description = "Legacy DynamoDB table name that can be used for Terraform state locking by older backend configs."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "terraform_state_key" {
  description = "Suggested S3 object key for the main Scope Terraform state file."
  value       = local.state_key
}

output "backend_config" {
  description = "Copy these values into terraform/backend.hcl before running terraform init -migrate-state."
  value = {
    bucket       = aws_s3_bucket.terraform_state.bucket
    key          = local.state_key
    region       = var.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

output "legacy_backend_config" {
  description = "DynamoDB-locking backend config for older Terraform versions that do not support S3 lockfiles."
  value = {
    bucket         = aws_s3_bucket.terraform_state.bucket
    key            = local.state_key
    region         = var.aws_region
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
    encrypt        = true
  }
}
