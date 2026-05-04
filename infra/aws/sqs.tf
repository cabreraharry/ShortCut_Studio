# Telemetry queue. Drains to CloudWatch Logs (configure a subscription
# manually if you want long-term retention or Athena queries — keeping
# that out of Terraform until the analytics workflow is decided).

resource "aws_sqs_queue" "events" {
  name                       = "${var.project_name}-install-events"
  message_retention_seconds  = 1209600  # 14 days, the SQS max
  visibility_timeout_seconds = 60
  receive_wait_time_seconds  = 20       # long polling
}

resource "aws_sqs_queue" "events_dlq" {
  name                      = "${var.project_name}-install-events-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue_redrive_policy" "events" {
  queue_url = aws_sqs_queue.events.id
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.events_dlq.arn
    maxReceiveCount     = 5
  })
}

# DLQ alarm. The events queue's redrive policy means anything that fails 5
# Lambda invocations lands here — silently, by default. The alarm fires when
# any messages are visible so we notice persistent failures (Lambda crashing,
# SQS permissions broken, payload schema drift) instead of letting telemetry
# rot for 14 days then fall off.
#
# Threshold = 1: even a single message is worth investigating. If the alarm
# becomes noisy in practice (intermittent transient failures), bump to e.g.
# 10 and lengthen the period.
resource "aws_cloudwatch_metric_alarm" "events_dlq_not_empty" {
  alarm_name          = "${var.project_name}-events-dlq-not-empty"
  alarm_description   = "Telemetry SQS DLQ has messages — investigate the events Lambda or upstream payloads."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.events_dlq.name
  }

  # Wire to SNS only when the operator has supplied an email; otherwise the
  # alarm still exists (visible in the AWS console) but nothing is emailed.
  alarm_actions = var.alarm_email != "" ? [aws_sns_topic.alarms[0].arn] : []
  ok_actions    = var.alarm_email != "" ? [aws_sns_topic.alarms[0].arn] : []

  tags = var.tags
}

# SNS topic + email subscription, only created when alarm_email is set.
# `count` keeps the resource optional without a separate module.
resource "aws_sns_topic" "alarms" {
  count = var.alarm_email != "" ? 1 : 0
  name  = "${var.project_name}-alarms"
  tags  = var.tags
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}
