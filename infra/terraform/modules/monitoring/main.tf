# Cross-cutting observability: an at-a-glance dashboard, app-layer error alarms,
# and a cost budget. RDS-specific alarms live in the rds-postgres module; this
# module covers the Amplify front door and overall spend, and unifies everything
# into one dashboard so the operator never has to dig through the console.

locals {
  alarm_actions   = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  monitor_amplify = var.amplify_app_id != ""
  make_budget     = var.monthly_budget_usd > 0 && var.alert_email != ""
}

# ---- Amplify front-door error alarm ----
# Metric names are lowercase "xx" (4xxErrors / 5xxErrors) — the AWS docs long
# showed the wrong casing (see aws-amplify/amplify-hosting#3961).
resource "aws_cloudwatch_metric_alarm" "amplify_5xx" {
  count               = local.monitor_amplify ? 1 : 0
  alarm_name          = "${var.name}-amplify-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrors"
  namespace           = "AWS/AmplifyHosting"
  period              = 300
  statistic           = "Sum"
  threshold           = var.amplify_5xx_threshold
  alarm_description   = "${var.name}: Amplify served more than ${var.amplify_5xx_threshold} 5xx responses in 5 min — SSR errors or DB/connection failures."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    App = var.amplify_app_id
  }

  tags = var.tags
}

# ---- Monthly cost budget ----
# Forecasted + actual notifications catch runaway spend (extra RDS, accidental
# duplicate envs, Lambda blow-ups) before the invoice arrives.
resource "aws_budgets_budget" "monthly" {
  count        = local.make_budget ? 1 : 0
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# ---- Unified dashboard ----
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = var.name

  dashboard_body = jsonencode({
    widgets = concat([
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title  = "RDS CPU & Connections",
          region = var.region,
          view   = "timeSeries",
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.db_instance_identifier],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.db_instance_identifier, { yAxis = "right" }]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6,
        properties = {
          title  = "RDS Memory & Free Storage",
          region = var.region,
          view   = "timeSeries",
          metrics = [
            ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", var.db_instance_identifier],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.db_instance_identifier, { yAxis = "right" }]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title  = "RDS Read/Write Latency",
          region = var.region,
          view   = "timeSeries",
          metrics = [
            ["AWS/RDS", "ReadLatency", "DBInstanceIdentifier", var.db_instance_identifier],
            ["AWS/RDS", "WriteLatency", "DBInstanceIdentifier", var.db_instance_identifier]
          ]
        }
      }
      ], local.monitor_amplify ? [
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title  = "Amplify Requests & Errors",
          region = var.region,
          view   = "timeSeries",
          metrics = [
            ["AWS/AmplifyHosting", "Requests", "App", var.amplify_app_id],
            ["AWS/AmplifyHosting", "5xxErrors", "App", var.amplify_app_id, { yAxis = "right" }],
            ["AWS/AmplifyHosting", "4xxErrors", "App", var.amplify_app_id, { yAxis = "right" }],
            ["AWS/AmplifyHosting", "Latency", "App", var.amplify_app_id]
          ]
        }
      }
    ] : [])
  })
}
