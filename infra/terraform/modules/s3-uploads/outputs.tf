output "bucket_name" {
  description = "Name of the uploads bucket (set as S3_BUCKET env var)."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "ARN of the uploads bucket (used by the IAM policy)."
  value       = aws_s3_bucket.this.arn
}
