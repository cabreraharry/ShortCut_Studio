output "releases_bucket" {
  description = "S3 bucket name for release payloads + manifests."
  value       = aws_s3_bucket.releases.id
}

output "cloudfront_domain" {
  description = "Default CloudFront domain (use this for payload URLs in the manifest until manage_dns = true)."
  value       = aws_cloudfront_distribution.releases.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by publish-release.mjs for cache invalidations after a publish."
  value       = aws_cloudfront_distribution.releases.id
}

output "api_endpoint" {
  description = "Default API Gateway HTTP endpoint. Use this as MANIFEST_URL in installer.nsh until manage_dns = true."
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/v1/manifest.json"
}

output "events_endpoint" {
  description = "POST endpoint for telemetry events."
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/v1/events"
}

output "events_queue_url" {
  description = "SQS queue URL for the events Lambda (informational; the Lambda already has it via env)."
  value       = aws_sqs_queue.events.url
}

output "publisher_iam_user" {
  description = "IAM user name for the release-publishing role. Create access keys for this user manually in the AWS console."
  value       = aws_iam_user.publisher.name
}

output "custom_domain" {
  description = "Custom domain for the deployment (only set when manage_dns = true)."
  value       = var.manage_dns ? var.domain_name : null
}
