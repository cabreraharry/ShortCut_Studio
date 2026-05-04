# Manifest-serving Lambda. Sources at lambda/manifest/.
#
# Build step before `terraform apply`:
#   cd infra/aws/lambda/manifest && npm install --production
# (Terraform's archive_file zips the directory after.)

data "archive_file" "manifest_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/manifest"
  output_path = "${path.module}/.terraform-build/manifest-lambda.zip"
  excludes    = ["package-lock.json"]
}

resource "aws_iam_role" "manifest_lambda" {
  name = "${var.project_name}-manifest-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "manifest_lambda_basic" {
  role       = aws_iam_role.manifest_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Read access to manifest + rollout JSON keys only — narrow least-privilege.
data "aws_iam_policy_document" "manifest_lambda_s3" {
  statement {
    effect  = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "${aws_s3_bucket.releases.arn}/manifests/*",
      "${aws_s3_bucket.releases.arn}/meta/*"
    ]
  }
}

resource "aws_iam_policy" "manifest_lambda_s3" {
  name   = "${var.project_name}-manifest-lambda-s3"
  policy = data.aws_iam_policy_document.manifest_lambda_s3.json
}

resource "aws_iam_role_policy_attachment" "manifest_lambda_s3" {
  role       = aws_iam_role.manifest_lambda.name
  policy_arn = aws_iam_policy.manifest_lambda_s3.arn
}

resource "aws_lambda_function" "manifest" {
  function_name = "${var.project_name}-manifest"
  filename      = data.archive_file.manifest_lambda.output_path
  source_code_hash = data.archive_file.manifest_lambda.output_base64sha256
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.manifest_lambda.arn
  timeout       = 5
  memory_size   = 256

  environment {
    variables = {
      RELEASES_BUCKET = aws_s3_bucket.releases.id
      RELEASES_REGION = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "manifest" {
  name              = "/aws/lambda/${aws_lambda_function.manifest.function_name}"
  retention_in_days = 30
}
