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

  # No inline ingress/egress here ON PURPOSE. The Amplify Lambda ingress is added
  # externally as a standalone aws_vpc_security_group_ingress_rule (to break the
  # SG <-> SG circular dependency), and inline blocks are authoritative for the
  # whole SG — so any inline rule here would fight that standalone rule on every
  # plan. All rules for this SG are therefore declared as standalone resources.
}

# CIDR-based ingress: laptop /32 for migrations, plus 0.0.0.0/0 when the app's
# compute is outside the VPC and reaches RDS over the public endpoint (see the
# allowed_cidr_blocks variable note).
resource "aws_vpc_security_group_ingress_rule" "db_from_cidr" {
  for_each          = toset(var.allowed_cidr_blocks)
  security_group_id = aws_security_group.db.id
  cidr_ipv4         = each.value
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
  description       = "PostgreSQL from allowed CIDR (migrations)"
  tags              = var.tags
}

resource "aws_vpc_security_group_egress_rule" "db_all_outbound" {
  security_group_id = aws_security_group.db.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "All outbound"
  tags              = var.tags
}

# Engine tuning. force_ssl enforces TLS at the server (not just the client's
# sslmode=require), and the timeouts/slow-query log keep the DB healthy and
# observable as load grows. Most of these are dynamic; force_ssl is static and
# applies on the next reboot (apply_immediately reboots when needed).
resource "aws_db_parameter_group" "this" {
  name        = "${var.identifier}-pg"
  family      = var.parameter_group_family
  description = "Tuning + TLS enforcement for ${var.identifier}"
  tags        = var.tags

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = tostring(var.slow_query_log_ms)
  }
  parameter {
    name  = "statement_timeout"
    value = tostring(var.statement_timeout_ms)
  }
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = tostring(var.idle_in_transaction_timeout_ms)
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  parameter_group_name = aws_db_parameter_group.this.name

  # Performance Insights — free with 7-day retention. Essential for diagnosing
  # query/connection load as the number of restaurants grows.
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? 7 : null

  allocated_storage = var.allocated_storage
  # Storage autoscaling: let RDS grow storage up to this cap automatically so the
  # DB never runs out of disk (a common cause of hard outages). 0 disables it.
  max_allocated_storage = var.max_allocated_storage > 0 ? var.max_allocated_storage : null
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.username
  password = var.password
  port     = 5432

  publicly_accessible    = var.publicly_accessible
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az                   = var.multi_az
  backup_retention_period    = var.backup_retention_days
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = var.skip_final_snapshot
  final_snapshot_identifier  = var.skip_final_snapshot ? null : "${var.identifier}-final"
  copy_tags_to_snapshot      = true
  auto_minor_version_upgrade = true

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
  alarm_description   = "${var.identifier}: DatabaseConnections above ${var.alarm_connections_threshold} — connection pool may be saturating. Lower Prisma connection_limit or scale the instance."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

# Disk full is a hard outage. Storage autoscaling helps, but alarm before it.
resource "aws_cloudwatch_metric_alarm" "free_storage_space" {
  alarm_name          = "${var.identifier}-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_free_storage_threshold_bytes
  alarm_description   = "${var.identifier}: FreeStorageSpace below ${floor(var.alarm_free_storage_threshold_bytes / 1073741824)} GB — disk may fill (hard outage)."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

# Latency alarms surface slow disks / missing indexes / overload early.
resource "aws_cloudwatch_metric_alarm" "read_latency" {
  alarm_name          = "${var.identifier}-high-read-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_read_latency_seconds
  alarm_description   = "${var.identifier}: ReadLatency above ${var.alarm_read_latency_seconds * 1000} ms — check slow queries / missing indexes."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "write_latency" {
  alarm_name          = "${var.identifier}-high-write-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_write_latency_seconds
  alarm_description   = "${var.identifier}: WriteLatency above ${var.alarm_write_latency_seconds * 1000} ms — check disk I/O / lock contention."
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  tags = var.tags
}

# ---- CloudWatch log retention ----
# RDS exports the "postgresql" and "upgrade" logs (see enabled_cloudwatch_logs_exports).
# Without a managed log group the retention is "never expire" → unbounded cost.
# NOTE: for an ALREADY-RUNNING instance these groups exist; import them once:
#   terraform import 'module.rds.aws_cloudwatch_log_group.postgresql' '/aws/rds/instance/<identifier>/postgresql'
#   terraform import 'module.rds.aws_cloudwatch_log_group.upgrade'    '/aws/rds/instance/<identifier>/upgrade'
resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/instance/${var.identifier}/postgresql"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "upgrade" {
  name              = "/aws/rds/instance/${var.identifier}/upgrade"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}
