output "secret_arn" {
  description = "ARN of the created secret (empty when create = false)."
  value       = var.create ? aws_secretsmanager_secret.this[0].arn : ""
}
