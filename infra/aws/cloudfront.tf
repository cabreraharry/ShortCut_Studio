# CloudFront distribution fronting the S3 releases bucket.
#
# v1: payload-only. Manifests are served directly from API Gateway (see
# apigateway.tf) so the stub only needs CloudFront for the big .7z + zip
# downloads. v2 can add path-based routing here so /v1/* goes to API GW
# under the same custom domain.

resource "aws_cloudfront_origin_access_control" "releases" {
  name                              = "${var.project_name}-releases-oac"
  description                       = "Origin Access Control for ${aws_s3_bucket.releases.id}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "releases" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.project_name} release payloads"
  http_version    = "http2"

  # Custom domain only when manage_dns = true. Otherwise CloudFront serves
  # via its default *.cloudfront.net hostname.
  aliases = var.manage_dns ? [var.domain_name] : []

  origin {
    origin_id                = "s3-releases"
    domain_name              = aws_s3_bucket.releases.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.releases.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-releases"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    # Long TTL — payloads are content-addressed by version (releases/<ver>/...)
    # so they're immutable. Cache hard, only re-invalidate on a new key.
    min_ttl     = 0
    default_ttl = 86400      # 1 day
    max_ttl     = 31536000   # 1 year

    compress = true

    forwarded_values {
      query_string = false
      headers      = []
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !var.manage_dns
    acm_certificate_arn            = var.manage_dns ? aws_acm_certificate_validation.cf_cert[0].certificate_arn : null
    ssl_support_method             = var.manage_dns ? "sni-only" : null
    minimum_protocol_version       = var.manage_dns ? "TLSv1.2_2021" : null
  }

  price_class = "PriceClass_100"  # NA + Europe; cheapest tier. Bump if you have global users.
}
