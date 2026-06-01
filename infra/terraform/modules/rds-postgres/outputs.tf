output "endpoint" {
  description = "Hostname of the RDS instance."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "Port of the RDS instance."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Database name."
  value       = aws_db_instance.this.db_name
}

output "database_url" {
  description = "Ready-to-use Prisma connection string (set as DATABASE_URL)."
  value       = "postgresql://${var.username}:${var.password}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${aws_db_instance.this.db_name}?schema=public&sslmode=require"
  sensitive   = true
}

output "security_group_id" {
  description = "ID of the DB security group (add ingress rules here if needed)."
  value       = aws_security_group.db.id
}
