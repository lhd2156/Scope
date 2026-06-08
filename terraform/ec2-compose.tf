data "aws_ami" "ec2_compose_al2023" {
  count = local.deploy_ec2_compose && var.ec2_compose_ami_id == null ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_iam_policy_document" "ec2_compose_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ec2_compose_dlm_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ec2_compose_photos_bucket" {
  count = local.deploy_ec2_compose ? 1 : 0

  statement {
    actions = [
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.photos.arn,
    ]
  }

  statement {
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = [
      "${aws_s3_bucket.photos.arn}/*",
    ]
  }

  statement {
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey",
    ]
    resources = [
      aws_kms_key.photos.arn,
    ]
  }
}

locals {
  ec2_compose_public_key             = var.ec2_compose_public_key != null ? trimspace(var.ec2_compose_public_key) : ""
  ec2_compose_key_pair_name          = var.ec2_compose_key_pair_name != null ? trimspace(var.ec2_compose_key_pair_name) : ""
  ec2_compose_manage_key_pair        = local.deploy_ec2_compose && local.ec2_compose_public_key != ""
  ec2_compose_managed_key_pair_name  = local.ec2_compose_key_pair_name != "" ? local.ec2_compose_key_pair_name : "${local.name_prefix}-ec2-compose-ssh"
  ec2_compose_existing_key_pair_name = local.ec2_compose_key_pair_name != "" ? local.ec2_compose_key_pair_name : null
  ec2_compose_effective_key_pair_name = (
    local.ec2_compose_manage_key_pair ? local.ec2_compose_managed_key_pair_name : local.ec2_compose_existing_key_pair_name
  )
  ec2_compose_instance_key_pair_name = (
    local.ec2_compose_manage_key_pair ?
    aws_key_pair.ec2_compose[0].key_name :
    local.ec2_compose_effective_key_pair_name
  )
  ec2_compose_ami_id = (
    var.ec2_compose_ami_id != null ?
    var.ec2_compose_ami_id :
    one(data.aws_ami.ec2_compose_al2023[*].id)
  )
  ec2_compose_bootstrap_commands = [
    "set -eux",
    "dnf update -y",
    "dnf install -y docker git tar",
    "mkdir -p /usr/local/lib/docker/cli-plugins",
    "curl -fsSL https://github.com/docker/compose/releases/download/${var.docker_compose_version}/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose",
    "curl -fsSL https://github.com/docker/buildx/releases/download/${var.docker_buildx_version}/buildx-${var.docker_buildx_version}.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx",
    "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
    "chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx",
    "if [ ! -f /swapfile ]; then fallocate -l ${var.ec2_compose_swap_size_gib}G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=${var.ec2_compose_swap_size_gib * 1024}; chmod 600 /swapfile; mkswap /swapfile; fi",
    "grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab",
    "swapon --show | grep -q '/swapfile' || swapon /swapfile",
    "systemctl enable --now docker",
    "usermod -aG docker ec2-user",
    "mkdir -p /opt/scope/releases /opt/scope/shared /opt/scope/shared/media /opt/scope/shared/sqlserver /opt/scope/shared/config",
    "chown -R ec2-user:ec2-user /opt/scope"
  ]
  ec2_compose_user_data        = join("\n", concat(["#!/bin/bash"], local.ec2_compose_bootstrap_commands))
  ec2_compose_public_ip        = try(aws_eip.ec2_compose[0].public_ip, aws_instance.ec2_compose[0].public_ip, null)
  ec2_compose_root_volume_name = "${local.name_prefix}-ec2-compose-root"
  ec2_compose_enable_snapshots = local.deploy_ec2_compose && var.ec2_compose_enable_root_snapshots
}

resource "aws_key_pair" "ec2_compose" {
  count = local.ec2_compose_manage_key_pair ? 1 : 0

  key_name   = local.ec2_compose_effective_key_pair_name
  public_key = local.ec2_compose_public_key

  tags = merge(local.common_tags, {
    Name = local.ec2_compose_effective_key_pair_name
  })
}

# HTTPS egress remains destination-open because production workloads call
# dynamic AWS, registry, map, mail, and AI endpoints. Protocol and port are
# restricted here; enforce destination allowlisting through an egress proxy
# if the production architecture later provides one.
#trivy:ignore:AVD-AWS-0104
resource "aws_security_group" "ec2_compose" {
  count       = local.deploy_ec2_compose ? 1 : 0
  name        = "${local.name_prefix}-ec2-compose"
  description = "Scope EC2 Compose fallback access"
  vpc_id      = aws_vpc.scope.id

  ingress {
    description = "HTTP from Cloudflare"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = local.cloudflare_ipv4_cidrs
  }

  ingress {
    description = "HTTPS from Cloudflare"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.cloudflare_ipv4_cidrs
  }

  dynamic "ingress" {
    for_each = length(var.ec2_compose_admin_ipv4_cidrs) > 0 ? [1] : []

    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ec2_compose_admin_ipv4_cidrs
    }
  }

  egress {
    description = "HTTPS to external APIs, registries, and AWS services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS over UDP to the VPC resolver"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "DNS over TCP to the VPC resolver"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2-compose"
  })
}

resource "aws_iam_role" "ec2_compose" {
  count              = local.deploy_ec2_compose ? 1 : 0
  name               = "${local.name_prefix}-ec2-compose-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_compose_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ec2_compose_ssm_managed" {
  count      = local.deploy_ec2_compose ? 1 : 0
  role       = aws_iam_role.ec2_compose[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ec2_compose_photos_bucket" {
  count = local.deploy_ec2_compose ? 1 : 0

  name   = "${local.name_prefix}-ec2-compose-photos-bucket"
  role   = aws_iam_role.ec2_compose[0].id
  policy = data.aws_iam_policy_document.ec2_compose_photos_bucket[0].json
}

resource "aws_iam_instance_profile" "ec2_compose" {
  count = local.deploy_ec2_compose ? 1 : 0
  name  = "${local.name_prefix}-ec2-compose"
  role  = aws_iam_role.ec2_compose[0].name

  tags = local.common_tags
}

resource "aws_iam_role" "ec2_compose_dlm" {
  count              = local.ec2_compose_enable_snapshots ? 1 : 0
  name               = "${local.name_prefix}-ec2-compose-dlm"
  assume_role_policy = data.aws_iam_policy_document.ec2_compose_dlm_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ec2_compose_dlm" {
  count      = local.ec2_compose_enable_snapshots ? 1 : 0
  role       = aws_iam_role.ec2_compose_dlm[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_instance" "ec2_compose" {
  count = local.deploy_ec2_compose ? 1 : 0

  ami                         = local.ec2_compose_ami_id
  instance_type               = var.ec2_compose_instance_type
  subnet_id                   = aws_subnet.public["0"].id
  vpc_security_group_ids      = [aws_security_group.ec2_compose[0].id]
  associate_public_ip_address = true
  key_name                    = local.ec2_compose_instance_key_pair_name
  iam_instance_profile        = aws_iam_instance_profile.ec2_compose[0].name
  user_data                   = local.ec2_compose_user_data

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ec2_compose_root_volume_size_gib
    encrypted             = true
    delete_on_termination = true
  }

  volume_tags = merge(local.common_tags, {
    Name = local.ec2_compose_root_volume_name
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2-compose"
  })

  depends_on = [
    aws_internet_gateway.scope,
    aws_iam_role_policy.ec2_compose_photos_bucket,
    aws_iam_role_policy_attachment.ec2_compose_ssm_managed
  ]

  lifecycle {
    # Keep the single-host runtime stable. AMI and bootstrap updates should be
    # rolled by an intentional replacement, not by every Terraform plan.
    ignore_changes = [
      ami,
      user_data,
    ]
  }
}

resource "aws_dlm_lifecycle_policy" "ec2_compose_root" {
  count = local.ec2_compose_enable_snapshots ? 1 : 0

  description        = "Daily snapshots for ${local.name_prefix} EC2 Compose root volume"
  execution_role_arn = aws_iam_role.ec2_compose_dlm[0].arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    target_tags = {
      Name = local.ec2_compose_root_volume_name
    }

    schedule {
      name      = "daily-root-volume-snapshots"
      copy_tags = true

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = [var.ec2_compose_snapshot_time_utc]
      }

      retain_rule {
        count = var.ec2_compose_snapshot_retain_count
      }

      tags_to_add = merge(local.common_tags, {
        Name          = "${local.name_prefix}-ec2-compose-root-snapshot"
        SnapshotOwner = "dlm"
      })
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2-compose-root-snapshots"
  })

  depends_on = [
    aws_iam_role_policy_attachment.ec2_compose_dlm
  ]
}

resource "aws_eip" "ec2_compose" {
  count = local.deploy_ec2_compose && var.ec2_compose_allocate_elastic_ip ? 1 : 0

  domain   = "vpc"
  instance = aws_instance.ec2_compose[0].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2-compose-ip"
  })
}
