variable "aws_region" {
  description = "AWS region for Scope infrastructure."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project slug used for naming cloud resources."
  type        = string
  default     = "scope"
}

variable "stack_profile" {
  description = "Terraform deployment profile. Use credit-saver for the low-cost shared AWS primitives, lightsail for the always-on single-box Scope runtime, or full for the complete EKS/RDS stack."
  type        = string
  default     = "credit-saver"

  validation {
    condition     = contains(["credit-saver", "lightsail", "full"], var.stack_profile)
    error_message = "stack_profile must be one of credit-saver, lightsail, or full."
  }
}

variable "container_registry" {
  description = "Container registry strategy. Keep ghcr for the current GitHub Actions flow, or switch to ecr when the AWS-native registry is required for the full EKS stack."
  type        = string
  default     = "ghcr"

  validation {
    condition     = contains(["ghcr", "ecr"], var.container_registry)
    error_message = "container_registry must be either ghcr or ecr."
  }
}

variable "lightsail_availability_zone" {
  description = "Optional Lightsail availability zone override. Leave null to use the first available AZ in the selected region."
  type        = string
  default     = null
}

variable "lightsail_blueprint_id" {
  description = "Lightsail blueprint ID for the always-on Scope runtime."
  type        = string
  default     = "amazon_linux_2023"
}

variable "lightsail_bundle_id" {
  description = "Lightsail bundle ID for the always-on Scope runtime. large_3_0 is the current 8 GB / $44 Linux plan."
  type        = string
  default     = "large_3_0"
}

variable "lightsail_ip_address_type" {
  description = "IP address type for the Lightsail instance."
  type        = string
  default     = "dualstack"

  validation {
    condition     = contains(["dualstack", "ipv4", "ipv6"], var.lightsail_ip_address_type)
    error_message = "lightsail_ip_address_type must be one of dualstack, ipv4, or ipv6."
  }
}

variable "lightsail_key_pair_name" {
  description = "Optional Lightsail key pair name. Leave null to use the regional default Lightsail key pair."
  type        = string
  default     = null
}

variable "lightsail_public_key" {
  description = "Optional OpenSSH public key material used to create a dedicated Lightsail key pair for Scope deployments."
  type        = string
  default     = null
}

variable "lightsail_enable_auto_snapshots" {
  description = "Whether to enable daily automatic Lightsail instance snapshots."
  type        = bool
  default     = true
}

variable "lightsail_auto_snapshot_time" {
  description = "UTC hour when Lightsail should create the daily automatic snapshot."
  type        = string
  default     = "06:00"

  validation {
    condition     = can(regex("^([01][0-9]|2[0-3]):00$", var.lightsail_auto_snapshot_time))
    error_message = "lightsail_auto_snapshot_time must use HH:00 24-hour UTC format."
  }
}

variable "lightsail_admin_ipv4_cidrs" {
  description = "IPv4 CIDR allowlist for SSH access to the Lightsail instance. Narrow this immediately for any shared environment."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "lightsail_admin_ipv6_cidrs" {
  description = "IPv6 CIDR allowlist for SSH access to the Lightsail instance."
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Environment name appended to provisioned resources."
  type        = string
  default     = "staging"
}

variable "vpc_cidr" {
  description = "Primary VPC CIDR block."
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks. Must align with the selected AZ count."
  type        = list(string)
  default     = ["10.42.0.0/24", "10.42.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks. Must align with the selected AZ count."
  type        = list(string)
  default     = ["10.42.10.0/24", "10.42.11.0/24"]
}

variable "eks_cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "scope"
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.30"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for the default EKS node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_node_desired_size" {
  description = "Desired node count for the default EKS node group."
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "Minimum node count for the default EKS node group."
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "Maximum node count for the default EKS node group."
  type        = number
  default     = 3
}

variable "sqlserver_instance_class" {
  description = "RDS instance class for SQL Server."
  type        = string
  default     = "db.t3.small"
}

variable "sqlserver_allocated_storage" {
  description = "Allocated storage in GiB for the SQL Server instance."
  type        = number
  default     = 20
}

variable "sqlserver_master_username" {
  description = "Master username for the SQL Server RDS instance."
  type        = string
  default     = "scopeadmin"
}

variable "sqlserver_master_password" {
  description = "Master password for the SQL Server RDS instance."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.sqlserver_master_password == null || length(var.sqlserver_master_password) >= 16
    error_message = "sqlserver_master_password must be at least 16 characters when provided."
  }
}

variable "sqlserver_backup_retention_days" {
  description = "Backup retention window for SQL Server."
  type        = number
  default     = 7
}

variable "photos_bucket_name" {
  description = "Globally unique S3 bucket name used for Scope photo storage."
  type        = string
}

variable "cognito_domain_prefix" {
  description = "Unique Cognito hosted UI domain prefix."
  type        = string
}

variable "tags" {
  description = "Additional resource tags applied to all provisioned resources."
  type        = map(string)
  default     = {}
}
