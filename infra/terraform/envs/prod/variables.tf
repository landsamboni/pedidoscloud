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
variable "admin_user" {
  type    = string
  default = "admin"
}

variable "admin_password" {
  type      = string
  sensitive = true
}

variable "restaurant_user" {
  type    = string
  default = "restaurante"
}

variable "restaurant_password" {
  type      = string
  sensitive = true
}

# ---- Optional ----
variable "enable_secrets_manager" {
  description = "Also store secrets in AWS Secrets Manager (off by default)."
  type        = bool
  default     = false
}
