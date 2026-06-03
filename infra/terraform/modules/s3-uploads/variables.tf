variable "bucket_name" {
  description = "Globally-unique name for the uploads bucket (e.g. pedidoscloud-uploads-staging)."
  type        = string
}

variable "force_destroy" {
  description = "Allow Terraform to delete the bucket even if it still contains objects. Use true for throwaway staging, false for prod."
  type        = bool
  default     = false
}

variable "enable_versioning" {
  description = "Keep previous versions of objects (helps recover from accidental overwrites)."
  type        = bool
  default     = true
}

variable "noncurrent_version_retention_days" {
  description = "When versioning is on, days to keep noncurrent object versions before expiring them to save storage."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
