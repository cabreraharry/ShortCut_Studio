provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = var.tags
  }
}

# us-east-1 alias is required for ACM certs that front CloudFront — CF can
# only consume certs from us-east-1 regardless of where the rest of the
# stack lives. Defined unconditionally; only referenced when manage_dns = true.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile

  default_tags {
    tags = var.tags
  }
}

data "aws_caller_identity" "current" {}

locals {
  releases_bucket_name = (
    var.releases_bucket_name != ""
    ? var.releases_bucket_name
    : "${var.project_name}-releases-${data.aws_caller_identity.current.account_id}"
  )
}
