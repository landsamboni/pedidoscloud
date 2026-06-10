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

# ---- SNS alerts topic ----
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

module "s3_uploads" {
  source        = "../../modules/s3-uploads"
  bucket_name   = "${local.name}-uploads"
  force_destroy = false # protect production data
  tags          = local.tags
}

module "iam" {
  source     = "../../modules/iam"
  name       = "${local.name}-app"
  bucket_arn = module.s3_uploads.bucket_arn
  tags       = local.tags
}

module "rds" {
  source                = "../../modules/rds-postgres"
  identifier            = local.name
  db_name               = var.db_name
  username              = var.db_username
  password              = var.db_password
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  publicly_accessible   = var.db_publicly_accessible
  allowed_cidr_blocks   = var.db_allowed_cidr_blocks
  alarm_topic_arn       = aws_sns_topic.alerts.arn
  connection_limit      = var.db_connection_limit
  deletion_protection   = true  # prevent accidental prod deletion
  skip_final_snapshot   = false # take a final snapshot on destroy
  backup_retention_days = 14
  tags                  = local.tags
}

module "amplify" {
  source              = "../../modules/amplify-app"
  name                = local.name
  repository_url      = var.github_repository_url
  github_access_token = var.github_access_token
  branch_name         = var.amplify_branch
  branch_stage        = "PRODUCTION"

  # Amplify rejects env var names starting with "AWS"; see lib/storage.ts.
  # AMPLIFY_MONOREPO_APP_ROOT is handled by the module at the app level (not here).
  # AUTH_SECRET is REQUIRED — the app throws on boot without it in production.
  environment_variables = {
    AUTH_SECRET          = var.auth_secret
    DATABASE_URL         = module.rds.database_url
    STORAGE_DRIVER       = "s3"
    S3_REGION            = var.aws_region
    S3_BUCKET            = module.s3_uploads.bucket_name
    S3_ACCESS_KEY_ID     = module.iam.access_key_id
    S3_SECRET_ACCESS_KEY = module.iam.secret_access_key
    ADMIN_USER           = var.admin_user
    ADMIN_PASSWORD       = var.admin_password
    ADMIN_TOTP_SECRET    = var.admin_totp_secret
  }

  tags = local.tags
}

module "monitoring" {
  source                 = "../../modules/monitoring"
  name                   = local.name
  region                 = var.aws_region
  db_instance_identifier = module.rds.instance_identifier
  amplify_app_id         = module.amplify.app_id
  alarm_topic_arn        = aws_sns_topic.alerts.arn
  alert_email            = var.alert_email
  monthly_budget_usd     = var.monthly_budget_usd
  tags                   = local.tags
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
