variable "name" {
  description = "Environment name prefix (e.g. pedidoscloud-staging)."
  type        = string
}

variable "region" {
  description = "AWS region (used for the dashboard widgets)."
  type        = string
}

variable "db_instance_identifier" {
  description = "RDS DBInstanceIdentifier to chart and alarm on."
  type        = string
}

variable "amplify_app_id" {
  description = "Amplify app ID for traffic/error metrics and alarms. Empty = skip Amplify monitoring."
  type        = string
  default     = ""
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for alarm notifications. Empty = alarms without notifications."
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Email for AWS Budgets cost notifications. Empty = no budget created."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD. Alerts at 80% (actual) and 100% (forecast). 0 = no budget."
  type        = number
  default     = 0
}

variable "amplify_5xx_threshold" {
  description = "Alarm when 5xxErrors (sum over 5 min) exceeds this."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
