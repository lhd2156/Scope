output "terraform_state_bucket_name" {
  description = "S3 bucket name that stores the Atlas Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "terraform_state_key" {
  description = "Suggested S3 object key for the main Atlas Terraform state file."
  value       = local.state_key
}

output "backend_config" {
  description = "Copy these values into terraform/backend.hcl before running terraform init -migrate-state."
  value = {
    bucket         = aws_s3_bucket.terraform_state.bucket
    key            = local.state_key
    region         = var.aws_region
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
    encrypt        = true
  }
}
