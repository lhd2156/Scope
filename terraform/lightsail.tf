locals {
  lightsail_availability_zone = coalesce(var.lightsail_availability_zone, data.aws_availability_zones.available.names[0])
  lightsail_web_ipv4_cidrs    = var.lightsail_ip_address_type == "ipv6" ? [] : ["0.0.0.0/0"]
  lightsail_web_ipv6_cidrs    = var.lightsail_ip_address_type == "ipv4" ? [] : ["::/0"]
  lightsail_ssh_ipv4_cidrs    = var.lightsail_ip_address_type == "ipv6" ? [] : var.lightsail_admin_ipv4_cidrs
  lightsail_ssh_ipv6_cidrs    = var.lightsail_ip_address_type == "ipv4" ? [] : var.lightsail_admin_ipv6_cidrs
  lightsail_public_key            = trimspace(coalesce(var.lightsail_public_key, ""))
  lightsail_key_pair_name         = trimspace(coalesce(var.lightsail_key_pair_name, ""))
  lightsail_manage_key_pair       = local.deploy_lightsail && local.lightsail_public_key != ""
  lightsail_effective_key_pair_name = local.lightsail_manage_key_pair ? (
    local.lightsail_key_pair_name != "" ? local.lightsail_key_pair_name : "${local.name_prefix}-ssh"
  ) : (
    local.lightsail_key_pair_name != "" ? local.lightsail_key_pair_name : null
  )
  lightsail_instance_key_pair_name = (
    local.lightsail_manage_key_pair ?
    aws_lightsail_key_pair.scope[0].name :
    local.lightsail_effective_key_pair_name
  )
  lightsail_bootstrap_commands = [
    "set -eux",
    "dnf update -y",
    "dnf install -y curl docker docker-compose-plugin git tar",
    "systemctl enable --now docker",
    "usermod -aG docker ec2-user",
    "mkdir -p /opt/scope/releases /opt/scope/shared /opt/scope/shared/media /opt/scope/shared/sqlserver /opt/scope/shared/config",
    "chown -R ec2-user:ec2-user /opt/scope"
  ]
  lightsail_user_data = join(" && ", local.lightsail_bootstrap_commands)
  lightsail_public_ports = concat(
    [
      {
        protocol   = "tcp"
        from_port  = 80
        to_port    = 80
        cidrs      = local.lightsail_web_ipv4_cidrs
        ipv6_cidrs = local.lightsail_web_ipv6_cidrs
      },
      {
        protocol   = "tcp"
        from_port  = 443
        to_port    = 443
        cidrs      = local.lightsail_web_ipv4_cidrs
        ipv6_cidrs = local.lightsail_web_ipv6_cidrs
      }
    ],
    length(local.lightsail_ssh_ipv4_cidrs) > 0 || length(local.lightsail_ssh_ipv6_cidrs) > 0 ? [
      {
        protocol   = "tcp"
        from_port  = 22
        to_port    = 22
        cidrs      = local.lightsail_ssh_ipv4_cidrs
        ipv6_cidrs = local.lightsail_ssh_ipv6_cidrs
      }
    ] : []
  )
}

resource "aws_lightsail_key_pair" "scope" {
  count = local.lightsail_manage_key_pair ? 1 : 0

  name       = local.lightsail_effective_key_pair_name
  public_key = local.lightsail_public_key
}

resource "aws_lightsail_instance" "scope" {
  count = local.deploy_lightsail ? 1 : 0

  name              = "${local.name_prefix}-app"
  availability_zone = local.lightsail_availability_zone
  blueprint_id      = var.lightsail_blueprint_id
  bundle_id         = var.lightsail_bundle_id
  ip_address_type   = var.lightsail_ip_address_type
  key_pair_name     = local.lightsail_instance_key_pair_name
  user_data         = local.lightsail_user_data

  add_on {
    type          = "AutoSnapshot"
    status        = var.lightsail_enable_auto_snapshots ? "Enabled" : "Disabled"
    snapshot_time = var.lightsail_auto_snapshot_time
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })
}

resource "aws_lightsail_static_ip" "scope" {
  count = local.deploy_lightsail ? 1 : 0
  name  = "${local.name_prefix}-app-ip"
}

resource "aws_lightsail_static_ip_attachment" "scope" {
  count = local.deploy_lightsail ? 1 : 0

  static_ip_name = aws_lightsail_static_ip.scope[0].name
  instance_name  = aws_lightsail_instance.scope[0].name
}

resource "aws_lightsail_instance_public_ports" "scope" {
  count = local.deploy_lightsail ? 1 : 0

  instance_name = aws_lightsail_instance.scope[0].name

  dynamic "port_info" {
    for_each = local.lightsail_public_ports

    content {
      protocol   = port_info.value.protocol
      from_port  = port_info.value.from_port
      to_port    = port_info.value.to_port
      cidrs      = port_info.value.cidrs
      ipv6_cidrs = port_info.value.ipv6_cidrs
    }
  }
}
