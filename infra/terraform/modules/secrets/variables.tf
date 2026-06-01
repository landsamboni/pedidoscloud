variable "create" {
  description = "Whether to create the secret. Optional for the MVP — Amplify env vars already hold these values."
  type        = bool
  default     = false
}

variable "name" {
  description = "Secrets Manager secret name (e.g. pedidoscloud/staging)."
  type        = string
}

variable "secret_values" {
  description = "Map of key/value pairs stored as a single JSON secret (e.g. DATABASE_URL, AWS keys)."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "recovery_window_days" {
  description = "Days before a deleted secret is purged (0 = delete immediately)."
  type        = number
  default     = 0
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
