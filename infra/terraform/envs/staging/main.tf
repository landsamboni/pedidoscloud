terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  name = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ---- Default VPC & subnets (used for Amplify Lambda VPC connectivity) ----

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Route tables of the default VPC — needed to attach the S3 VPC Gateway endpoint.
data "aws_route_tables" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ---- S3 VPC Gateway endpoint ----------------------------------------
# Free. Allows Amplify Lambda (in the VPC) to reach S3 without a NAT Gateway.
# Lambda in a VPC has no internet access, so this endpoint is required for uploads.

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.default.ids
  tags              = merge(local.tags, { Name = "${local.name}-s3-endpoint" })
}

# ---- Amplify Lambda security group ----------------------------------
# The SSR Lambda runs inside the VPC with this SG. Allows all egress so the
# Lambda can reach the RDS SG (5432) and the S3 endpoint (443). Lambda in a
# VPC has no internet access unless a NAT Gateway exists — we intentionally
# omit NAT to keep costs at $0. S3 traffic is routed through the VPC endpoint.

resource "aws_security_group" "amplify_lambda" {
  name        = "${local.name}-amplify-lambda"
  description = "Amplify WEB_COMPUTE SSR Lambda — outbound to RDS and S3 endpoint"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.tags

  # Allow all outbound. Lambda has no internet anyway (no NAT); outbound is
  # limited to VPC-local destinations and VPC endpoints in practice.
  egress {
    description = "All outbound (VPC-local + VPC endpoints only, no internet without NAT)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---- Cross-SG rules (break circular dependency) ---------------------
# Created AFTER both SGs exist. Uses aws_vpc_security_group_ingress/egress_rule
# (AWS provider ≥ 5.x) which does not conflict with inline SG rules.

# Allow Amplify Lambda SG to connect to RDS on port 5432.
resource "aws_vpc_security_group_egress_rule" "amplify_to_rds" {
  security_group_id            = aws_security_group.amplify_lambda.id
  referenced_security_group_id = module.rds.security_group_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL to RDS security group"
  tags                         = local.tags
}

# Allow Amplify Lambda SG to reach RDS (inbound on RDS side).
resource "aws_vpc_security_group_ingress_rule" "rds_from_amplify" {
  security_group_id            = module.rds.security_group_id
  referenced_security_group_id = aws_security_group.amplify_lambda.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from Amplify WEB_COMPUTE Lambda"
  tags                         = local.tags
}

# ---- SNS alerts topic -----------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---- Infrastructure modules -----------------------------------------

module "s3_uploads" {
  source        = "../../modules/s3-uploads"
  bucket_name   = "${local.name}-uploads"
  force_destroy = true # throwaway staging data
  tags          = local.tags
}

module "iam" {
  source     = "../../modules/iam"
  name       = "${local.name}-app"
  bucket_arn = module.s3_uploads.bucket_arn
  tags       = local.tags
}

module "rds" {
  source              = "../../modules/rds-postgres"
  identifier          = local.name
  db_name             = var.db_name
  username            = var.db_username
  password            = var.db_password
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  publicly_accessible = var.db_publicly_accessible
  # Only allow known IPs (laptop for migrations). Amplify Lambda access is added
  # via aws_vpc_security_group_ingress_rule above (not 0.0.0.0/0).
  allowed_cidr_blocks         = var.db_allowed_cidr_blocks
  alarm_topic_arn             = aws_sns_topic.alerts.arn
  alarm_connections_threshold = 40
  deletion_protection         = false
  skip_final_snapshot         = true
  tags                        = local.tags
}

module "amplify" {
  source              = "../../modules/amplify-app"
  name                = local.name
  repository_url      = var.github_repository_url
  github_access_token = var.github_access_token
  branch_name         = var.amplify_branch
  branch_stage        = "DEVELOPMENT"

  # NOTE: VPC connectivity (to associate Amplify Lambda with the Lambda SG and
  # VPC subnets) is not yet supported by the Terraform AWS provider for
  # aws_amplify_app. Configure it manually in the Amplify console once:
  # App settings → Build settings → VPC configuration
  # → select subnets from the default VPC and the amplify-lambda security group.
  # The SG and VPC resources are created above and ready to be used.

  # NOTE: Amplify rejects env var names starting with "AWS"; S3 credentials use
  # S3_-prefixed names that the app reads in lib/storage.ts.
  # AMPLIFY_MONOREPO_APP_ROOT is handled by the module at the app level (not here).
  environment_variables = {
    DATABASE_URL         = module.rds.database_url
    STORAGE_DRIVER       = "s3"
    S3_REGION            = var.aws_region
    S3_BUCKET            = module.s3_uploads.bucket_name
    S3_ACCESS_KEY_ID     = module.iam.access_key_id
    S3_SECRET_ACCESS_KEY = module.iam.secret_access_key
    ADMIN_USER           = var.admin_user
    ADMIN_PASSWORD       = var.admin_password
    RESTAURANT_USER      = var.restaurant_user
    RESTAURANT_PASSWORD  = var.restaurant_password
  }

  tags = local.tags
}

module "secrets" {
  source = "../../modules/secrets"
  create = var.enable_secrets_manager
  name   = "${var.project}/${var.environment}"
  secret_values = {
    DATABASE_URL         = module.rds.database_url
    S3_ACCESS_KEY_ID     = module.iam.access_key_id
    S3_SECRET_ACCESS_KEY = module.iam.secret_access_key
  }
  tags = local.tags
}
