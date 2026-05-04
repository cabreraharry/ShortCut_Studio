# Telemetry-ingest Lambda. Sources at lambda/events/.
#
# Build step before `terraform apply`:
#   cd infra/aws/lambda/events && npm install --production

data "archive_file" "events_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/events"
  output_path = "${path.module}/.terraform-build/events-lambda.zip"
  excludes    = ["package-lock.json"]
}

resource "aws_iam_role" "events_lambda" {
  name = "${var.project_name}-events-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "events_lambda_basic" {
  role       = aws_iam_role.events_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Send-only on the events queue; nothing else.
data "aws_iam_policy_document" "events_lambda_sqs" {
  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage", "sqs:GetQueueUrl"]
    resources = [aws_sqs_queue.events.arn]
  }
}

resource "aws_iam_policy" "events_lambda_sqs" {
  name   = "${var.project_name}-events-lambda-sqs"
  policy = data.aws_iam_policy_document.events_lambda_sqs.json
}

resource "aws_iam_role_policy_attachment" "events_lambda_sqs" {
  role       = aws_iam_role.events_lambda.name
  policy_arn = aws_iam_policy.events_lambda_sqs.arn
}

resource "aws_lambda_function" "events" {
  function_name = "${var.project_name}-events"
  filename      = data.archive_file.events_lambda.output_path
  source_code_hash = data.archive_file.events_lambda.output_base64sha256
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.events_lambda.arn
  timeout       = 5
  memory_size   = 256

  environment {
    variables = {
      EVENTS_QUEUE_URL = aws_sqs_queue.events.url
      EVENTS_REGION    = var.aws_region
    }
  }
}

resource "aws_cloudwatch_log_group" "events" {
  name              = "/aws/lambda/${aws_lambda_function.events.function_name}"
  retention_in_days = 30
}
