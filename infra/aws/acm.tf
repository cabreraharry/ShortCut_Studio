# ACM cert + Route53 records — gated by var.manage_dns. When false, the
# entire DNS / TLS path is skipped and the deployment uses default
# *.cloudfront.net + *.execute-api.* hostnames.
#
# Prerequisite when manage_dns = true: var.route53_zone_name's hosted zone
# must already exist (the registrar's nameservers must point at Route53).
# Terraform doesn't provision the zone itself — that's a one-time manual
# step at the registrar.

data "aws_route53_zone" "main" {
  count = var.manage_dns ? 1 : 0
  name  = var.route53_zone_name
}

# Cert MUST live in us-east-1 to be usable by CloudFront, regardless of
# where the rest of the stack runs.
resource "aws_acm_certificate" "cf_cert" {
  count             = var.manage_dns ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.manage_dns ? {
    for dvo in aws_acm_certificate.cf_cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  } : {}

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cf_cert" {
  count                   = var.manage_dns ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cf_cert[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# DNS A-alias from the custom domain to CloudFront.
resource "aws_route53_record" "cf_alias" {
  count   = var.manage_dns ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.releases.domain_name
    zone_id                = aws_cloudfront_distribution.releases.hosted_zone_id
    evaluate_target_health = false
  }
}
