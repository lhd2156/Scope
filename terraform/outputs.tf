output "vpc_id" {
  description = "Atlas VPC identifier."
  value       = aws_vpc.atlas.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ingress/load balancers."
  value       = [for subnet in aws_subnet.public : subnet.id]
}

output "private_subnet_ids" {
  description = "Private subnet IDs for application/data workloads."
  value       = [for subnet in aws_subnet.private : subnet.id]
}

output "eks_cluster_name" {
  description = "EKS cluster name."
  value       = aws_eks_cluster.atlas.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint."
  value       = aws_eks_cluster.atlas.endpoint
}

output "sqlserver_endpoint" {
  description = "RDS SQL Server endpoint."
  value       = aws_db_instance.sqlserver.address
}

output "photos_bucket_name" {
  description = "S3 bucket used for Atlas photo storage."
  value       = aws_s3_bucket.photos.bucket
}

output "ecr_repository_urls" {
  description = "Published ECR repository URLs keyed by Atlas service name."
  value       = {
    for name, repo in aws_ecr_repository.service : name => repo.repository_url
  }
}

output "cognito_user_pool_id" {
  description = "Cognito user pool identifier."
  value       = aws_cognito_user_pool.atlas.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client identifier for the frontend."
  value       = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain prefix."
  value       = aws_cognito_user_pool_domain.atlas.domain
}
