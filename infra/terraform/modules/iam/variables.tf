variable "name" {
  description = "Name for the IAM user the app uses to access S3 (e.g. pedidoscloud-staging-app)."
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the uploads bucket the app is allowed to read/write."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
