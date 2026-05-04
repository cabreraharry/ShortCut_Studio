variable "aws_region" {
  description = "AWS region for all resources except CloudFront (CF is global; ACM cert for CF must live in us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile name to use. Set to null to fall back to default credentials chain."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Short identifier used as a name prefix on every resource."
  type        = string
  default     = "shortcutstudio"
}

variable "releases_bucket_name" {
  description = "Globally-unique S3 bucket name for release payloads + manifests. Override only if there's a collision; the default uses project_name."
  type        = string
  default     = ""
}

variable "manage_dns" {
  description = "Whether to provision Route53 record + ACM cert for a custom domain (e.g. updates.shortcutstudio.app). When false, the deployment uses default *.cloudfront.net + *.execute-api.* URLs and Route53/ACM are skipped entirely. Set to true once you've registered the domain and delegated to Route53."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Custom domain for the manifest + payload URLs. Required when manage_dns = true. Example: updates.shortcutstudio.app"
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Route53 hosted zone the domain lives in. Example: shortcutstudio.app"
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Optional email address that receives CloudWatch alarm notifications (e.g. when the telemetry SQS DLQ has messages). Leave empty to skip SNS provisioning entirely; the alarm itself still exists and is visible in the AWS console."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default = {
    Project   = "ShortCutStudio"
    ManagedBy = "terraform"
  }
}
