variable "aws_region" {
  description = "AWS region for Atlas infrastructure."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project slug used for naming cloud resources."
  type        = string
  default     = "atlas"
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
  default     = "atlas"
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
  default     = "atlasadmin"
}

variable "sqlserver_master_password" {
  description = "Master password for the SQL Server RDS instance."
  type        = string
  sensitive   = true
}

variable "sqlserver_backup_retention_days" {
  description = "Backup retention window for SQL Server."
  type        = number
  default     = 7
}

variable "photos_bucket_name" {
  description = "Globally unique S3 bucket name used for Atlas photo storage."
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
