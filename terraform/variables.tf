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
  description = "Terraform deployment profile. Use credit-saver for the low-cost shared AWS primitives, lightsail for the preferred single-box runtime, ec2-compose for the quota-friendly single-box fallback, or full for the complete EKS/RDS stack."
  type        = string
  default     = "credit-saver"

  validation {
    condition     = contains(["credit-saver", "lightsail", "ec2-compose", "full"], var.stack_profile)
    error_message = "stack_profile must be one of credit-saver, lightsail, ec2-compose, or full."
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
  description = "Lightsail bundle ID for the always-on Scope runtime. medium_3_0 is the current approved 4 GB / $24 Linux plan; use large_3_0 only after quota approval."
  type        = string
  default     = "medium_3_0"

  validation {
    condition     = can(regex("^[a-z0-9]+_[0-9]+_[0-9]+$", var.lightsail_bundle_id))
    error_message = "lightsail_bundle_id must look like an AWS Lightsail bundle ID such as medium_3_0."
  }
}

variable "lightsail_swap_size_gib" {
  description = "Swap file size provisioned during Lightsail bootstrap. Medium hosts need swap headroom for Compose plus SQL Server startup."
  type        = number
  default     = 8

  validation {
    condition     = var.lightsail_swap_size_gib >= 4 && var.lightsail_swap_size_gib <= 16
    error_message = "lightsail_swap_size_gib must be between 4 and 16 GiB."
  }
}

variable "lightsail_data_disk_size_gib" {
  description = "Optional Lightsail block storage disk size for durable Compose data. Set to 0 to disable. Priced separately from the instance bundle."
  type        = number
  default     = 160

  validation {
    condition     = var.lightsail_data_disk_size_gib == 0 || (var.lightsail_data_disk_size_gib >= 8 && var.lightsail_data_disk_size_gib <= 1280)
    error_message = "lightsail_data_disk_size_gib must be 0, or between 8 and 1280 GiB."
  }
}

variable "docker_compose_version" {
  description = "Pinned Docker Compose CLI plugin version installed by single-host bootstrap scripts."
  type        = string
  default     = "v5.1.4"

  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+$", var.docker_compose_version))
    error_message = "docker_compose_version must be a pinned semver tag such as v5.1.4."
  }
}

variable "docker_buildx_version" {
  description = "Pinned Docker Buildx CLI plugin version installed by single-host bootstrap scripts."
  type        = string
  default     = "v0.34.1"

  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+$", var.docker_buildx_version))
    error_message = "docker_buildx_version must be a pinned semver tag such as v0.34.1."
  }
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
  description = "IPv4 CIDR allowlist for SSH access to the Lightsail instance. Leave empty unless an allowlisted runner/VPN/admin IP needs SSH."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.lightsail_admin_ipv4_cidrs : can(cidrhost(cidr, 0))])
    error_message = "lightsail_admin_ipv4_cidrs entries must be valid CIDR blocks."
  }
}

variable "lightsail_admin_ipv6_cidrs" {
  description = "IPv6 CIDR allowlist for SSH access to the Lightsail instance."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.lightsail_admin_ipv6_cidrs : can(cidrhost(cidr, 0))])
    error_message = "lightsail_admin_ipv6_cidrs entries must be valid CIDR blocks."
  }
}

variable "ec2_compose_ami_id" {
  description = "Optional AMI override for the EC2 Compose fallback. Leave null to use the latest Amazon Linux 2023 x86_64 AMI."
  type        = string
  default     = null
}

variable "ec2_compose_instance_type" {
  description = "EC2 instance type for the Compose fallback. t3a.medium is the cost-safe default; t3a.large is closer to the 8 GB Lightsail target but exceeds the current credit plan."
  type        = string
  default     = "t3a.medium"
}

variable "ec2_compose_root_volume_size_gib" {
  description = "Root gp3 EBS volume size for the EC2 Compose fallback."
  type        = number
  default     = 80

  validation {
    condition     = var.ec2_compose_root_volume_size_gib >= 40
    error_message = "ec2_compose_root_volume_size_gib must be at least 40 GiB for the Scope Compose stack."
  }
}

variable "enforce_credit_guardrails" {
  description = "Whether Terraform should fail plans/applies that exceed the configured credit window or profile cost ceiling."
  type        = bool
  default     = true
}

variable "credit_guard_limit_usd" {
  description = "Maximum estimated AWS usage allowed for the selected runtime window before Terraform refuses the apply."
  type        = number
  default     = 190
}

variable "credit_guard_runtime_days" {
  description = "Runtime window used for cost guard estimates."
  type        = number
  default     = 113

  validation {
    condition     = var.credit_guard_runtime_days > 0
    error_message = "credit_guard_runtime_days must be greater than 0."
  }
}

variable "credit_guard_start_on" {
  description = "UTC date when the current credit guard window starts."
  type        = string
  default     = "2026-06-03"

  validation {
    condition     = can(regex("^20[0-9]{2}-[0-9]{2}-[0-9]{2}$", var.credit_guard_start_on))
    error_message = "credit_guard_start_on must use YYYY-MM-DD format."
  }
}

variable "credit_guard_expires_on" {
  description = "UTC date when Terraform should stop allowing this credit-window deployment."
  type        = string
  default     = "2026-09-24"

  validation {
    condition     = can(regex("^20[0-9]{2}-[0-9]{2}-[0-9]{2}$", var.credit_guard_expires_on))
    error_message = "credit_guard_expires_on must use YYYY-MM-DD format."
  }
}

variable "credit_guard_credit_saver_monthly_usd" {
  description = "Conservative monthly estimate for the credit-saver profile."
  type        = number
  default     = 5
}

variable "credit_guard_lightsail_monthly_usd" {
  description = "Monthly estimate for the Lightsail profile. Defaults to the approved medium_3_0 Linux bundle."
  type        = number
  default     = 24
}

variable "credit_guard_addon_monthly_usd" {
  description = "Optional monthly reserve for reviewed add-ons such as an edge/CDN/sweeper layer. Added to the selected profile estimate."
  type        = number
  default     = 0

  validation {
    condition     = var.credit_guard_addon_monthly_usd >= 0
    error_message = "credit_guard_addon_monthly_usd must be zero or greater."
  }
}

variable "credit_guard_addon_name" {
  description = "Human-readable label for the optional credit-guard add-on reserve."
  type        = string
  default     = "none"
}

variable "credit_guard_ec2_compose_monthly_usd" {
  description = "Monthly estimate for the EC2 Compose fallback including t3a.medium compute, 80 GiB gp3 storage, and public IPv4 baseline."
  type        = number
  default     = 37.50
}

variable "credit_guard_full_monthly_usd" {
  description = "Conservative monthly estimate for the full EKS/RDS/NAT profile. It intentionally exceeds the current credit window unless explicitly overridden."
  type        = number
  default     = 450
}

variable "enable_credit_guard_budget" {
  description = "Whether to create an AWS Budget for the configured credit limit when the main stack is applied."
  type        = bool
  default     = true
}

variable "credit_guard_budget_subscriber_emails" {
  description = "Email subscribers for AWS Budget alerts. Leave empty to create the budget without email notifications."
  type        = list(string)
  default     = []
}

variable "ec2_compose_key_pair_name" {
  description = "Optional existing EC2 key pair name for the Compose fallback. If omitted, ec2_compose_public_key is used to create one."
  type        = string
  default     = null
}

variable "ec2_compose_public_key" {
  description = "Optional OpenSSH public key material used to create a dedicated EC2 key pair for the Compose fallback."
  type        = string
  default     = null
}

variable "ec2_compose_admin_ipv4_cidrs" {
  description = "IPv4 CIDR allowlist for SSH access to the EC2 Compose fallback. Narrow this before shared use."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.ec2_compose_admin_ipv4_cidrs : can(cidrhost(cidr, 0))])
    error_message = "ec2_compose_admin_ipv4_cidrs entries must be valid CIDR blocks."
  }
}

variable "ec2_compose_swap_size_gib" {
  description = "Swap file size provisioned during EC2 Compose bootstrap."
  type        = number
  default     = 6

  validation {
    condition     = var.ec2_compose_swap_size_gib >= 2
    error_message = "ec2_compose_swap_size_gib must be at least 2 GiB."
  }
}

variable "ec2_compose_allocate_elastic_ip" {
  description = "Whether to allocate an Elastic IP for the EC2 Compose fallback. Disabled by default to avoid extra idle resources."
  type        = bool
  default     = false
}

variable "ec2_compose_enable_root_snapshots" {
  description = "Whether to create an AWS DLM policy for daily EC2 Compose root volume snapshots."
  type        = bool
  default     = true
}

variable "ec2_compose_snapshot_time_utc" {
  description = "UTC time when the EC2 Compose root volume snapshot policy should create daily snapshots."
  type        = string
  default     = "07:00"

  validation {
    condition     = can(regex("^([01][0-9]|2[0-3]):00$", var.ec2_compose_snapshot_time_utc))
    error_message = "ec2_compose_snapshot_time_utc must use HH:00 24-hour UTC format."
  }
}

variable "ec2_compose_snapshot_retain_count" {
  description = "Number of daily EC2 Compose root volume snapshots to retain."
  type        = number
  default     = 3

  validation {
    condition     = var.ec2_compose_snapshot_retain_count >= 1 && var.ec2_compose_snapshot_retain_count <= 14
    error_message = "ec2_compose_snapshot_retain_count must be between 1 and 14."
  }
}

variable "public_dns_zone_name" {
  description = "Optional public DNS zone name to manage in Route53 for the selected single-host runtime."
  type        = string
  default     = null
}

variable "public_dns_ttl_seconds" {
  description = "TTL for Terraform-managed public DNS records."
  type        = number
  default     = 60

  validation {
    condition     = var.public_dns_ttl_seconds >= 30 && var.public_dns_ttl_seconds <= 3600
    error_message = "public_dns_ttl_seconds must be between 30 and 3600 seconds."
  }
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

variable "vpc_flow_log_retention_days" {
  description = "CloudWatch Logs retention period for VPC flow logs."
  type        = number
  default     = 14

  validation {
    condition = contains([
      1,
      3,
      5,
      7,
      14,
      30,
      60,
      90,
      120,
      150,
      180,
      365,
      400,
      545,
      731,
      1096,
      1827,
      2192,
      2557,
      2922,
      3288,
      3653
    ], var.vpc_flow_log_retention_days)
    error_message = "vpc_flow_log_retention_days must be a CloudWatch Logs supported retention value."
  }
}

variable "eks_cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "scope"
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS control plane."
  type        = string
  default     = "1.35"
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

variable "eks_endpoint_public_access" {
  description = "Whether the EKS Kubernetes API server exposes a public endpoint. Keep false for production unless a narrow eks_public_access_cidrs allowlist is configured."
  type        = bool
  default     = false
}

variable "eks_public_access_cidrs" {
  description = "IPv4 CIDRs allowed to reach the EKS public API endpoint when eks_endpoint_public_access is true."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.eks_public_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "eks_public_access_cidrs entries must be valid CIDR blocks."
  }
}

variable "sqlserver_instance_class" {
  description = "RDS instance class for SQL Server."
  type        = string
  default     = "db.m6i.large"
}

variable "sqlserver_engine" {
  description = "RDS SQL Server engine edition. The production full-stack default uses Standard Edition so Multi-AZ is supported."
  type        = string
  default     = "sqlserver-se"

  validation {
    condition     = contains(["sqlserver-se", "sqlserver-ee", "sqlserver-ex", "sqlserver-web"], var.sqlserver_engine)
    error_message = "sqlserver_engine must be one of sqlserver-se, sqlserver-ee, sqlserver-ex, or sqlserver-web."
  }
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

variable "sqlserver_multi_az" {
  description = "Whether to run the RDS SQL Server instance in Multi-AZ mode. Enable for the full production stack when using an engine/license class that supports Multi-AZ."
  type        = bool
  default     = true
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
