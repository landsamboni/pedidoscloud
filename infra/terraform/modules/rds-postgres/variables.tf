variable "identifier" {
  description = "RDS instance identifier (e.g. pedidoscloud-staging)."
  type        = string
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "pedidoscloud"
}

variable "username" {
  description = "Master username."
  type        = string
  default     = "pedidoscloud"
}

variable "password" {
  description = "Master password (sensitive)."
  type        = string
  sensitive   = true
}

variable "engine_version" {
  description = "PostgreSQL major/minor version."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "Instance size. db.t3.micro is fine for an MVP."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Initial storage in GB."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Upper bound (GB) for RDS storage autoscaling. Must be >= allocated_storage. Set 0 to disable autoscaling."
  type        = number
  default     = 100
}

variable "publicly_accessible" {
  description = "Whether the instance gets a public endpoint (needed for migrations from laptop)."
  type        = bool
  default     = true
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect on 5432 (e.g. laptop /32 for migrations). NOTE: if the consuming app's compute is not in the VPC (e.g. Amplify WEB_COMPUTE SSR without VPC connectivity), it reaches RDS over the public endpoint and this must include 0.0.0.0/0."
  type        = list(string)
  default     = []
}

variable "vpc_id" {
  description = "VPC to place the security group in. Empty string = use the account's default VPC."
  type        = string
  default     = ""
}

variable "multi_az" {
  description = "Multi-AZ deployment (higher availability, ~2x cost). Off for MVP."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Automated backup retention in days (0 disables backups)."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Prevent accidental deletion. Turn on for prod."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on destroy. true for throwaway staging, false for prod."
  type        = bool
  default     = true
}

# ---- Engine tuning (parameter group) ----

variable "parameter_group_family" {
  description = "RDS parameter group family. Must match the engine major version (e.g. postgres16)."
  type        = string
  default     = "postgres16"
}

variable "statement_timeout_ms" {
  description = "Server-side statement_timeout in ms — kills runaway app queries so one bad query can't pin a connection. Generous enough for normal queries and migrations. 0 disables."
  type        = number
  default     = 30000 # 30s
}

variable "idle_in_transaction_timeout_ms" {
  description = "idle_in_transaction_session_timeout in ms — reclaims connections leaked mid-transaction (a common failure mode under serverless load). 0 disables."
  type        = number
  default     = 60000 # 60s
}

variable "slow_query_log_ms" {
  description = "log_min_duration_statement in ms — log queries slower than this to CloudWatch for diagnosis. -1 disables."
  type        = number
  default     = 1000 # 1s
}

variable "performance_insights_enabled" {
  description = "Enable RDS Performance Insights (free with 7-day retention) to diagnose load as tenant count grows."
  type        = bool
  default     = true
}

# ---- Connection pooling (Prisma) ----

variable "connection_limit" {
  description = "Prisma connection_limit appended to DATABASE_URL — the max DB connections ONE SSR Lambda instance opens. Keep small on serverless: connections = connection_limit x concurrent warm Lambdas, capped by the instance's max_connections (~112 for db.t3.micro, ~225 for db.t3.small)."
  type        = number
  default     = 5
}

variable "pool_timeout_s" {
  description = "Prisma pool_timeout (seconds) — how long a query waits for a free connection before erroring. Lets short bursts queue instead of failing."
  type        = number
  default     = 15
}

# ---- CloudWatch alarms ----

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications. Leave empty to create alarms without notifications (visible in console only)."
  type        = string
  default     = ""
}

variable "alarm_memory_threshold_bytes" {
  description = "FreeableMemory alarm threshold in bytes. Default 200 MB."
  type        = number
  default     = 209715200 # 200 MB
}

variable "alarm_connections_threshold" {
  description = "DatabaseConnections alarm threshold. Scale at ~50-80 for db.t3.micro."
  type        = number
  default     = 40
}

variable "alarm_free_storage_threshold_bytes" {
  description = "FreeStorageSpace alarm threshold in bytes — alert before the disk fills (a hard outage). Default 2 GB."
  type        = number
  default     = 2147483648 # 2 GB
}

variable "alarm_read_latency_seconds" {
  description = "ReadLatency alarm threshold in seconds. Default 20 ms."
  type        = number
  default     = 0.02
}

variable "alarm_write_latency_seconds" {
  description = "WriteLatency alarm threshold in seconds. Default 20 ms."
  type        = number
  default     = 0.02
}

variable "log_retention_days" {
  description = "Retention for the RDS CloudWatch log groups (postgresql, upgrade). Bounds log storage cost."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
