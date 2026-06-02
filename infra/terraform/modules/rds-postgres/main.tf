# Single-instance Amazon RDS PostgreSQL for the MVP.
# Security: ingress limited to known CIDR blocks (laptop) + Amplify Lambda SG
# (added as aws_vpc_security_group_ingress_rule from the env, not inline here,
# to avoid circular dependencies). SSL enforced via sslmode=require in DATABASE_URL.

data "aws_vpc" "default" {
  default = true
}

locals {
  vpc_id        = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default.id
  alarm_actions = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
}

resource "aws_security_group" "db" {
  name        = "${var.identifier}-db"
  description = "Allow PostgreSQL access for ${var.identifier}"
  vpc_id      = local.vpc_id
  tags        = var.tags

  lifecycle {
    # AWS does not allow updating SG descriptions in-place (requires destroy+recreate).
    # Ignore description changes to prevent accidentally destroying a live RDS SG.
    ignore_changes = [description]
  }

  # CIDR-based ingress for manual migrations from known IPs (e.g. laptop).
  # Amplify Lambda ingress is added externally as aws_vpc_security_group_ingress_rule
  # to avoid the circular dependency: Lambda SG ↔ RDS SG.
  dynamic "ingress" {
    for_each = length(var.allowed_cidr_blocks) > 0 ? [1] : []
    content {
      description = "PostgreSQL from allowed CIDRs (migrations)"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = var.allowed_cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.username
  password = var.password
  port     = 5432

  publicly_accessible    = var.publicly_accessible
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.identifier}-final"

  # Ship PostgreSQL error and upgrade logs to CloudWatch for audit and debugging.
  # "postgresql" captures connections, disconnections, errors, and slow queries
  # (when log_min_duration_statement is set via a parameter group).
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  apply_immediately = true
  tags              = var.tags
}

# ---- CloudWatch alarms ----

resource "aws_cloudwatch_metric_alarm" "freeable_memory" {
  alarm_name          = "${var.identifier}-low-memory"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300 # 5 min average
  statistic           = "Average"
  threshold           = var.alarm_memory_threshold_bytes
  alarm_description   = "${var.identifier}: FreeableMemory below ${var.alarm_memory_threshold_bytes / 1048576} MB — consider upgrading to db.t3.small"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "${var.identifier}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "${var.identifier}: CPU above 80% — check for missing indexes or runaway queries before scaling up"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.identifier}-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_connections_threshold
  alarm_description   = "${var.identifier}: DatabaseConnections above ${var.alarm_connections_threshold} — check for connection leaks or scale up"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}
