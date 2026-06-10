variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used as a resource name prefix."
  type        = string
  default     = "pedidoscloud"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "prod"
}

# ---- GitHub / Amplify ----
variable "github_repository_url" {
  description = "Full GitHub repo URL (https://github.com/landsamboni/pedidoscloud)."
  type        = string
}

variable "github_access_token" {
  description = "GitHub PAT with repo access for Amplify."
  type        = string
  sensitive   = true
}

variable "amplify_branch" {
  description = "Branch Amplify builds for this environment."
  type        = string
  default     = "main"
}

# ---- Database ----
variable "db_name" {
  type    = string
  default = "pedidoscloud"
}

variable "db_username" {
  type    = string
  default = "pedidoscloud"
}

variable "db_password" {
  description = "RDS master password."
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_connection_limit" {
  description = "Prisma connection_limit per SSR Lambda instance. db.t3.small allows ~225 connections; keep this x peak concurrent Lambdas under that."
  type        = number
  default     = 10
}

variable "db_publicly_accessible" {
  type    = bool
  default = true
}

variable "db_allowed_cidr_blocks" {
  description = "CIDRs allowed to reach Postgres (e.g. your laptop IP /32)."
  type        = list(string)
  default     = []
}

# ---- App auth ----
# Admins authenticate with these env-var credentials; restaurants authenticate
# against a bcrypt password stored in the database (see apps/web/lib/auth.ts).
# The old RESTAURANT_USER/PASSWORD HTTP Basic Auth vars were removed — the app no
# longer reads them.
variable "admin_user" {
  type    = string
  default = "admin"
}

variable "admin_password" {
  type      = string
  sensitive = true
}

variable "admin_totp_secret" {
  description = "Optional TOTP secret for admin MFA. Empty = MFA disabled."
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_secret" {
  description = "Secret key for signing JWT session cookies (32+ random chars). Generate with: openssl rand -base64 32. REQUIRED — the app throws in production without it."
  type        = string
  sensitive   = true
}

# ---- Monitoring ----
variable "alert_email" {
  description = "Email for CloudWatch alarm + budget notifications. Empty = console-only alarms, no budget."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD; emails alert_email at 80% actual and 100% forecast. 0 disables."
  type        = number
  default     = 150
}

# ---- Optional ----
variable "enable_secrets_manager" {
  description = "Also store secrets in AWS Secrets Manager (off by default)."
  type        = bool
  default     = false
}
