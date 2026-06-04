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

output "lightsail_data_disk_size_gib" {
  description = "Attached Lightsail block storage size for durable Compose data."
  value       = local.lightsail_manage_data_disk ? aws_lightsail_disk.scope_data[0].size_in_gb : 0
}

output "lightsail_data_disk_name" {
  description = "Attached Lightsail block storage disk name for durable Compose data."
  value       = local.lightsail_manage_data_disk ? aws_lightsail_disk.scope_data[0].name : null
}

output "ec2_compose_instance_id" {
  description = "EC2 instance ID for the Compose fallback runtime."
  value       = local.deploy_ec2_compose ? aws_instance.ec2_compose[0].id : null
}

output "ec2_compose_public_ip" {
  description = "Public IP for the EC2 Compose fallback runtime."
  value       = local.deploy_ec2_compose ? local.ec2_compose_public_ip : null
}

output "ec2_compose_private_ip" {
  description = "Private IP for the EC2 Compose fallback runtime."
  value       = local.deploy_ec2_compose ? aws_instance.ec2_compose[0].private_ip : null
}

output "ec2_compose_username" {
  description = "Default SSH username for the EC2 Compose fallback runtime."
  value       = local.deploy_ec2_compose ? "ec2-user" : null
}

output "ec2_compose_instance_type" {
  description = "EC2 instance type for the Compose fallback runtime."
  value       = local.deploy_ec2_compose ? aws_instance.ec2_compose[0].instance_type : null
}

output "ec2_compose_security_group_id" {
  description = "Security group ID for the EC2 Compose fallback runtime."
  value       = local.deploy_ec2_compose ? aws_security_group.ec2_compose[0].id : null
}

output "ec2_compose_root_volume_size_gib" {
  description = "Root gp3 EBS volume size for the EC2 Compose fallback runtime."
  value       = local.deploy_ec2_compose ? var.ec2_compose_root_volume_size_gib : null
}

output "ec2_compose_root_snapshot_policy_id" {
  description = "AWS DLM policy ID for EC2 Compose root volume snapshots."
  value       = local.ec2_compose_enable_snapshots ? aws_dlm_lifecycle_policy.ec2_compose_root[0].id : null
}

output "compose_host_public_ip" {
  description = "Public IP for the selected single-host Compose runtime."
  value       = local.deploy_lightsail ? aws_lightsail_static_ip.scope[0].ip_address : local.deploy_ec2_compose ? local.ec2_compose_public_ip : null
}

output "compose_host_username" {
  description = "SSH username for the selected single-host Compose runtime."
  value       = local.deploy_lightsail ? aws_lightsail_instance.scope[0].username : local.deploy_ec2_compose ? "ec2-user" : null
}

output "public_dns_zone_id" {
  description = "Route53 public hosted zone ID when Terraform manages public DNS."
  value       = local.manage_public_dns ? aws_route53_zone.scope_public[0].zone_id : null
}

output "public_dns_name_servers" {
  description = "Route53 nameservers for the Terraform-managed public DNS zone."
  value       = local.manage_public_dns ? aws_route53_zone.scope_public[0].name_servers : []
}

output "public_dns_apex_record" {
  description = "Apex hostname and IP address managed in Route53."
  value = local.manage_public_dns ? {
    name    = aws_route53_record.scope_apex[0].fqdn
    records = aws_route53_record.scope_apex[0].records
  } : null
}

output "public_dns_www_record" {
  description = "www hostname and IP address managed in Route53."
  value = local.manage_public_dns ? {
    name    = aws_route53_record.scope_www[0].fqdn
    records = aws_route53_record.scope_www[0].records
  } : null
}

output "high_cost_resources_enabled" {
  description = "Whether the profile currently includes EKS, NAT, and RDS resources."
  value       = local.deploy_full_stack
}

output "always_on_compute_enabled" {
  description = "Whether the selected profile includes an always-on Scope runtime."
  value       = local.deploy_lightsail || local.deploy_ec2_compose || local.deploy_full_stack
}

output "credit_guard_estimated_runtime_cost_usd" {
  description = "Estimated cost for the selected profile across the configured credit window."
  value       = local.credit_guard_estimated_runtime_cost_usd
}

output "credit_guard_profile_monthly_estimate_usd" {
  description = "Monthly cost estimate used by the credit guard for the selected profile."
  value       = lookup(local.credit_guard_profile_monthly_usd, local.stack_profile, var.credit_guard_full_monthly_usd)
}

output "credit_guard_addon_monthly_estimate_usd" {
  description = "Optional monthly add-on reserve included in the credit guard."
  value       = var.credit_guard_addon_monthly_usd
}

output "credit_guard_addon_name" {
  description = "Label for the optional monthly add-on reserve."
  value       = var.credit_guard_addon_name
}

output "credit_guard_total_monthly_estimate_usd" {
  description = "Total monthly estimate used by the credit guard after add-on reserves."
  value       = local.credit_guard_total_monthly_usd
}

output "credit_guard_limit_usd" {
  description = "Credit guard ceiling configured for this stack."
  value       = var.credit_guard_limit_usd
}

output "credit_guard_remaining_runtime_budget_usd" {
  description = "Estimated budget remaining inside the credit guard after the selected profile and add-on reserve."
  value       = floor((var.credit_guard_limit_usd - local.credit_guard_estimated_runtime_cost_usd) * 100) / 100
}

output "credit_guard_expires_on" {
  description = "UTC date after which Terraform refuses credit-guarded applies."
  value       = var.credit_guard_expires_on
}
