output "amplify_app_id" {
  value       = module.amplify.app_id
  description = "Amplify app ID."
}

output "amplify_branch_url" {
  value       = module.amplify.branch_url
  description = "Public Amplify URL — point the Cloudflare CNAME for staging here."
}

output "amplify_default_domain" {
  value       = module.amplify.default_domain
  description = "Amplify default domain."
}

output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "RDS hostname."
}

output "s3_bucket" {
  value       = module.s3_uploads.bucket_name
  description = "Uploads bucket name."
}

output "database_url" {
  value       = module.rds.database_url
  description = "Prisma connection string for running migrations (sensitive)."
  sensitive   = true
}

output "s3_access_key_id" {
  value       = module.iam.access_key_id
  description = "Access key id for the app's IAM user."
}

output "s3_secret_access_key" {
  value       = module.iam.secret_access_key
  description = "Secret access key for the app's IAM user (sensitive)."
  sensitive   = true
}

output "alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "SNS topic ARN for CloudWatch alarms. Subscribe additional endpoints here."
}

output "amplify_lambda_sg_id" {
  value       = aws_security_group.amplify_lambda.id
  description = "Security group ID of the Amplify SSR Lambda (for reference/debugging)."
}
