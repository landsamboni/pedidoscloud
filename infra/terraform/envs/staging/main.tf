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
  allowed_cidr_blocks = var.db_allowed_cidr_blocks
  deletion_protection = false
  skip_final_snapshot = true
  tags                = local.tags
}

module "amplify" {
  source              = "../../modules/amplify-app"
  name                = local.name
  repository_url      = var.github_repository_url
  github_access_token = var.github_access_token
  branch_name         = var.amplify_branch
  branch_stage        = "DEVELOPMENT"

  # NOTE: Amplify rejects env var names starting with "AWS"; S3 credentials use
  # S3_-prefixed names that the app reads in lib/storage.ts.
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
