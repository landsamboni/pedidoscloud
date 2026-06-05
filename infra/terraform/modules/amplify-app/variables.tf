variable "name" {
  description = "Amplify app name (e.g. pedidoscloud-staging)."
  type        = string
}

variable "repository_url" {
  description = "Full GitHub repository URL (e.g. https://github.com/landsamboni/pedidoscloud)."
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token with repo access, so Amplify can connect and pull. Sensitive."
  type        = string
  sensitive   = true
}

variable "branch_name" {
  description = "Git branch this Amplify app builds and deploys (e.g. staging or main)."
  type        = string
}

variable "monorepo_app_root" {
  description = "Path to the app within the monorepo (e.g. apps/web). Set at app level so Amplify detects it before branch vars are loaded. Leave empty for non-monorepo apps."
  type        = string
  default     = "apps/web"
}

variable "environment_variables" {
  description = "Environment variables passed to the build and SSR runtime (DATABASE_URL, S3_BUCKET, auth passwords, etc)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "branch_stage" {
  description = "Amplify branch stage label: PRODUCTION, BETA, DEVELOPMENT, EXPERIMENTAL or PULL_REQUEST."
  type        = string
  default     = "DEVELOPMENT"
}

variable "enable_auto_build" {
  description = "Automatically build & deploy when the branch receives a push."
  type        = bool
  default     = true
}

variable "custom_domain" {
  description = "Root domain for the Amplify custom domain association (e.g. pedidoscloud.com). Leave empty to skip."
  type        = string
  default     = ""
}

variable "custom_subdomains" {
  description = "Subdomains to associate with this branch (e.g. [\"app\", \"staging\"]). Ignored when custom_domain is empty."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
