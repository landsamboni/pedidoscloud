output "access_key_id" {
  description = "AWS_ACCESS_KEY_ID for the app."
  value       = aws_iam_access_key.app.id
}

output "secret_access_key" {
  description = "AWS_SECRET_ACCESS_KEY for the app (sensitive)."
  value       = aws_iam_access_key.app.secret
  sensitive   = true
}

output "user_name" {
  description = "Name of the created IAM user."
  value       = aws_iam_user.app.name
}
