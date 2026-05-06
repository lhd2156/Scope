output "vpc_id" {
  description = "Scope VPC identifier."
  value       = aws_vpc.scope.id
}

output "stack_profile" {
  description = "Active Terraform deployment profile."
  value       = local.stack_profile
}

output "runtime_platform" {
  description = "Primary always-on compute platform for the selected profile."
  value       = local.runtime_platform
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
  value       = local.deploy_eks ? aws_eks_cluster.scope[0].name : null
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint."
  value       = local.deploy_eks ? aws_eks_cluster.scope[0].endpoint : null
}

output "sqlserver_endpoint" {
  description = "RDS SQL Server endpoint."
  value       = local.deploy_sqlserver ? aws_db_instance.sqlserver[0].address : null
}

output "photos_bucket_name" {
  description = "S3 bucket used for Scope photo storage."
  value       = aws_s3_bucket.photos.bucket
}

output "ecr_repository_urls" {
  description = "Published ECR repository URLs keyed by Scope service name."
  value = {
    for name, repo in aws_ecr_repository.service : name => repo.repository_url
  }
}

output "cognito_user_pool_id" {
  description = "Cognito user pool identifier."
  value       = aws_cognito_user_pool.scope.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client identifier for the frontend."
  value       = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain prefix."
  value       = aws_cognito_user_pool_domain.scope.domain
}

output "lightsail_instance_name" {
  description = "Lightsail instance name for the always-on Scope runtime."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].name : null
}

output "lightsail_public_ip" {
  description = "Static public IP for the Lightsail instance."
  value       = local.deploy_lightsail ? aws_lightsail_static_ip.scope[0].ip_address : null
}

output "lightsail_private_ip" {
  description = "Private IP for the Lightsail instance."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].private_ip_address : null
}

output "lightsail_username" {
  description = "Default SSH username for the Lightsail blueprint."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].username : null
}

output "lightsail_bundle_id" {
  description = "Lightsail bundle ID used for the always-on Scope runtime."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].bundle_id : null
}

output "lightsail_key_pair_name" {
  description = "Lightsail key pair name used for Scope deployments."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].key_pair_name : null
}

output "lightsail_blueprint_id" {
  description = "Lightsail blueprint ID used for the always-on Scope runtime."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].blueprint_id : null
}

output "high_cost_resources_enabled" {
  description = "Whether the profile currently includes EKS, NAT, and RDS resources."
  value       = local.deploy_full_stack
}

output "always_on_compute_enabled" {
  description = "Whether the selected profile includes an always-on Scope runtime."
  value       = local.deploy_lightsail || local.deploy_full_stack
}
