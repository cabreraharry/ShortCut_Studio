# CI publisher role. The release-publishing pipeline (Phase 5's
# scripts/publish-release.mjs) needs:
#   - PutObject on the releases bucket (uploading .7z + .blockmap + manifest)
#   - CreateInvalidation on the CloudFront distribution
#
# Two ways to consume this role:
#   1. Long-lived IAM access keys: create them in the console for the
#      `shortcutstudio-publisher` user (once Terraform has provisioned the
#      user) and store as $env:AWS_ACCESS_KEY_ID + $env:AWS_SECRET_ACCESS_KEY
#      on the publishing machine.
#   2. AssumeRole from a base profile: shape Terraform to output the role
#      ARN and have publish-release.mjs call sts:AssumeRole. Cleaner for
#      CI/CD, more setup. Defer to v2.

resource "aws_iam_user" "publisher" {
  name = "${var.project_name}-publisher"
}

data "aws_iam_policy_document" "publisher" {
  statement {
    sid    = "WriteReleases"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:DeleteObject",
      "s3:GetObject",  # needed for upload-if-different optimizations
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.releases.arn,
      "${aws_s3_bucket.releases.arn}/*"
    ]
  }

  statement {
    sid       = "InvalidateCloudFront"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.releases.arn]
  }
}

resource "aws_iam_policy" "publisher" {
  name   = "${var.project_name}-publisher"
  policy = data.aws_iam_policy_document.publisher.json
}

resource "aws_iam_user_policy_attachment" "publisher" {
  user       = aws_iam_user.publisher.name
  policy_arn = aws_iam_policy.publisher.arn
}
