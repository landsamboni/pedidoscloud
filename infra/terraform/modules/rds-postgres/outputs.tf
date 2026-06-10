output "endpoint" {
  description = "Hostname of the RDS instance."
  value       = aws_db_instance.this.address
}

output "instance_identifier" {
  description = "DBInstanceIdentifier — used as the CloudWatch dimension."
  value       = aws_db_instance.this.identifier
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
  description = "Ready-to-use Prisma connection string (set as DATABASE_URL). Includes connection pooling tuned for serverless SSR."
  # connection_limit caps connections opened by ONE Lambda instance; pool_timeout
  # lets short bursts queue instead of erroring; connect_timeout fails fast on a
  # dead DB rather than hanging the request.
  value     = "postgresql://${var.username}:${var.password}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${aws_db_instance.this.db_name}?schema=public&sslmode=require&connection_limit=${var.connection_limit}&pool_timeout=${var.pool_timeout_s}&connect_timeout=10"
  sensitive = true
}

output "security_group_id" {
  description = "ID of the DB security group. Used by the env to add aws_vpc_security_group_ingress_rule from Amplify Lambda."
  value       = aws_security_group.db.id
}

output "vpc_id" {
  description = "VPC ID where RDS lives. Used by the env to create the Amplify Lambda SG in the same VPC."
  value       = local.vpc_id
}
