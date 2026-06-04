locals {
  public_dns_zone_name = var.public_dns_zone_name == null ? "" : trimsuffix(trimspace(var.public_dns_zone_name), ".")
  manage_public_dns    = local.public_dns_zone_name != "" && (local.deploy_lightsail || local.deploy_ec2_compose)
  public_dns_target_ip = local.deploy_lightsail ? aws_lightsail_static_ip.scope[0].ip_address : local.deploy_ec2_compose ? local.ec2_compose_public_ip : null
}

resource "aws_route53_zone" "scope_public" {
  count = local.manage_public_dns ? 1 : 0

  name = local.public_dns_zone_name

  tags = merge(local.common_tags, {
    Name = local.public_dns_zone_name
  })
}

resource "aws_route53_record" "scope_apex" {
  count = local.manage_public_dns ? 1 : 0

  zone_id = aws_route53_zone.scope_public[0].zone_id
  name    = local.public_dns_zone_name
  type    = "A"
  ttl     = var.public_dns_ttl_seconds
  records = [local.public_dns_target_ip]
}

resource "aws_route53_record" "scope_www" {
  count = local.manage_public_dns ? 1 : 0

  zone_id = aws_route53_zone.scope_public[0].zone_id
  name    = "www.${local.public_dns_zone_name}"
  type    = "A"
  ttl     = var.public_dns_ttl_seconds
  records = [local.public_dns_target_ip]
}
