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

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
