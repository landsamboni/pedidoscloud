# Single-instance Amazon RDS PostgreSQL for the MVP.
# Lives in the default VPC to keep networking trivial. SSL is enforced at the
# connection string level (sslmode=require) in the DATABASE_URL output.

data "aws_vpc" "default" {
  default = true
}

locals {
  vpc_id = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default.id
}

resource "aws_security_group" "db" {
  name        = "${var.identifier}-db"
  description = "Allow PostgreSQL access for ${var.identifier}"
  vpc_id      = local.vpc_id
  tags        = var.tags

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.identifier
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.username
  password = var.password
  port     = 5432

  publicly_accessible    = var.publicly_accessible
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.identifier}-final"

  apply_immediately = true
  tags              = var.tags
}
