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
  default     = "feature-menu"
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
  default     = "feature/flexible-menu"
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
  default = "db.t3.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_connection_limit" {
  description = "Prisma connection_limit per SSR Lambda instance (serverless connection pooling)."
  type        = number
  default     = 5
}

variable "db_publicly_accessible" {
  description = "Keep true: the Amplify SSR Lambda is NOT in the VPC (WEB_COMPUTE VPC connectivity is unavailable here), so it reaches RDS over the public endpoint. Access is restricted by the security group / db_allowed_cidr_blocks."
  type        = bool
  default     = true
}

variable "db_allowed_cidr_blocks" {
  description = "CIDRs allowed to connect to RDS port 5432. MUST include 0.0.0.0/0: the Amplify SSR Lambda is not in the VPC and connects from non-fixed AWS public IPs (removing it breaks the app). Add your laptop /32 too for migrations. Protected by a strong password + SSL."
  type        = list(string)
  default     = []
}

# ---- App auth ----
# Admins authenticate with these env-var credentials; restaurants authenticate
# against a bcrypt password stored in the database (see apps/web/lib/auth.ts).
variable "admin_user" {
  type    = string
  default = "admin"
}

variable "admin_password" {
  description = "Admin operator password (used at the /login screen)."
  type        = string
  sensitive   = true
}

variable "admin_totp_secret" {
  description = "Optional TOTP (authenticator app) secret for admin MFA. Empty = MFA disabled. Generate with otplib authenticator.generateSecret()."
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_secret" {
  description = "Secret key for signing JWT session cookies (32+ random chars). Generate with: openssl rand -base64 32"
  type        = string
  sensitive   = true
}

# ---- Monitoring ----
variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications (RDS memory, connections). Leave empty to create alarms without email (visible in CloudWatch console only)."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD; emails alert_email at 80% actual and 100% forecast. 0 disables."
  type        = number
  default     = 30
}

# ---- Optional ----
variable "enable_secrets_manager" {
  description = "Also store secrets in AWS Secrets Manager (off by default)."
  type        = bool
  default     = false
}
