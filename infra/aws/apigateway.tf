# HTTP API Gateway fronting both Lambdas.
#
# Routes:
#   GET  /v1/manifest.json   →  manifest Lambda
#   POST /v1/events          →  events Lambda
#
# HTTP API (v2) over REST API (v1) — much cheaper, simpler, and the auth
# story is fine since both endpoints are public-by-design.

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "ShortCut Studio update + telemetry endpoints"

  cors_configuration {
    # Stub + Electron app aren't browsers, so CORS is non-load-bearing. Open
    # CORS lets a browser-based test client (during development) hit the
    # endpoint without preflight grief.
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
    max_age       = 300
  }
}

# ----- Manifest integration ---------------------------------------------
resource "aws_apigatewayv2_integration" "manifest" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.manifest.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "manifest" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /v1/manifest.json"
  target    = "integrations/${aws_apigatewayv2_integration.manifest.id}"
}

resource "aws_lambda_permission" "manifest_apigw" {
  statement_id  = "AllowAPIGatewayInvokeManifest"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.manifest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ----- Events integration -----------------------------------------------
resource "aws_apigatewayv2_integration" "events" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.events.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "events" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /v1/events"
  target    = "integrations/${aws_apigatewayv2_integration.events.id}"
}

resource "aws_lambda_permission" "events_apigw" {
  statement_id  = "AllowAPIGatewayInvokeEvents"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.events.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ----- Stage ------------------------------------------------------------
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = 30
}
