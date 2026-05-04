# Releases bucket — holds:
#   manifests/v1/<channel>.json   manifest served by Lambda
#   meta/rollout.json             optional staged-rollout config
#   releases/<ver>/<arch>/...     .7z payloads + .blockmap files
#
# Versioning is on so a botched manifest publish can be rolled back with
# `aws s3api list-object-versions` + restore. Public access is fully blocked;
# all reads go through CloudFront via Origin Access Control.

resource "aws_s3_bucket" "releases" {
  bucket = local.releases_bucket_name
}

resource "aws_s3_bucket_versioning" "releases" {
  bucket = aws_s3_bucket.releases.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront → S3 access via Origin Access Control. Lambda has its own
# IAM-based read access (no OAC needed) and writes through the CI role.
data "aws_iam_policy_document" "releases_bucket_policy" {
  statement {
    sid     = "AllowCloudFrontRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.releases.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.releases.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "releases" {
  bucket = aws_s3_bucket.releases.id
  policy = data.aws_iam_policy_document.releases_bucket_policy.json
}
