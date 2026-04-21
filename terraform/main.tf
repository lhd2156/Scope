terraform {
  required_version = ">= 1.7.0"

  backend "s3" {
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

locals {
  name_prefix  = "${var.project_name}-${var.environment}"
  cluster_name = "${var.eks_cluster_name}-${var.environment}"
  service_images = toset([
    "atlas-core",
    "atlas-content",
    "atlas-intel",
    "atlas-frontend"
  ])
  common_tags = merge({
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "lhd2156/atlas"
  }, var.tags)
}

resource "aws_security_group" "sqlserver" {
  name        = "${local.name_prefix}-sqlserver"
  description = "Atlas SQL Server access within the VPC"
  vpc_id      = aws_vpc.atlas.id

  ingress {
    description = "SQL Server from Atlas VPC"
    from_port   = 1433
    to_port     = 1433
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sqlserver"
  })
}

resource "aws_db_subnet_group" "sqlserver" {
  name       = "${local.name_prefix}-sqlserver"
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sqlserver-subnets"
  })
}

resource "aws_db_instance" "sqlserver" {
  identifier                 = "${local.name_prefix}-sqlserver"
  engine                     = "sqlserver-ex"
  instance_class             = var.sqlserver_instance_class
  allocated_storage          = var.sqlserver_allocated_storage
  storage_type               = "gp3"
  db_subnet_group_name       = aws_db_subnet_group.sqlserver.name
  vpc_security_group_ids     = [aws_security_group.sqlserver.id]
  username                   = var.sqlserver_master_username
  password                   = var.sqlserver_master_password
  port                       = 1433
  backup_retention_period    = var.sqlserver_backup_retention_days
  delete_automated_backups   = true
  skip_final_snapshot        = true
  deletion_protection        = false
  publicly_accessible        = false
  multi_az                   = false
  auto_minor_version_upgrade = true
  apply_immediately          = true
  storage_encrypted          = true
  license_model              = "license-included"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sqlserver"
  })
}

resource "aws_s3_bucket" "photos" {
  bucket = var.photos_bucket_name

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-photos"
  })
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "photos" {
  bucket = aws_s3_bucket.photos.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cognito_user_pool" "atlas" {
  name                     = "${local.name_prefix}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "frontend" {
  name                                 = "${local.name_prefix}-frontend"
  user_pool_id                         = aws_cognito_user_pool.atlas.id
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = false
  supported_identity_providers         = ["COGNITO"]
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

resource "aws_cognito_user_pool_domain" "atlas" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.atlas.id
}

resource "aws_ecr_repository" "service" {
  for_each = local.service_images

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-${each.key}"
  })
}

resource "aws_eks_cluster" "atlas" {
  name     = local.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids              = concat([for subnet in aws_subnet.public : subnet.id], [for subnet in aws_subnet.private : subnet.id])
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_cluster_vpc_policy
  ]

  tags = merge(local.common_tags, {
    Name = local.cluster_name
  })
}

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.atlas.name
  node_group_name = "${local.cluster_name}-default"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = [for subnet in aws_subnet.private : subnet.id]
  instance_types  = var.eks_node_instance_types

  scaling_config {
    desired_size = var.eks_node_desired_size
    min_size     = var.eks_node_min_size
    max_size     = var.eks_node_max_size
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_read_only,
    aws_iam_role_policy_attachment.eks_ssm_managed
  ]

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-default"
  })
}
