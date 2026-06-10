terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  name = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

provider "aws" {
  region = var.aws_region

  # Tag every resource in the account by default. Resources also pass local.tags
  # explicitly (identical values), so this is a safety net for anything created
  # without an explicit tags argument (access keys, SG rules, etc.).
  default_tags {
    tags = local.tags
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
  description = "Amplify WEB_COMPUTE SSR Lambda - outbound to RDS and S3 endpoint"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.tags

  # No inline egress/ingress here ON PURPOSE. Every rule for this SG is declared
  # as a standalone aws_vpc_security_group_*_rule resource below. Inline rule
  # blocks are authoritative for the whole SG, so mixing them with the standalone
  # cross-SG rules makes the two fight on every plan (inline revokes the
  # standalone 5432 rule, the standalone resource re-adds it). That conflict is
  # what produced the recurring "2 to change" diff and the SG drift warning.
}

# Allow all outbound. The Lambda has no internet anyway (no NAT); outbound is
# limited to VPC-local destinations and the S3 VPC endpoint in practice.
resource "aws_vpc_security_group_egress_rule" "amplify_all_outbound" {
  security_group_id = aws_security_group.amplify_lambda.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "All outbound (VPC-local + VPC endpoints only, no internet without NAT)"
  tags              = local.tags
}

# ---- Cross-SG rules (break circular dependency) ---------------------
# Standalone rules created AFTER both SGs exist. ALL rules on these two SGs are
# standalone (the SG resources declare no inline ingress/egress) — inline +
# standalone on the same SG conflict and must not be mixed.

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
  # IMPORTANT: Amplify WEB_COMPUTE SSR cannot be attached to a VPC in this
  # account/version, so the SSR Lambda reaches RDS over the PUBLIC endpoint from
  # AWS-owned egress IPs that are not a fixed range. That means db_allowed_cidr_blocks
  # MUST include 0.0.0.0/0 for the app to connect — the cross-SG rule
  # (rds_from_amplify) only helps if/when the Lambda is in the VPC, which it isn't.
  # Do NOT remove 0.0.0.0/0 unless VPC connectivity is configured first (it broke
  # the app once). Risk is mitigated by a strong DB password + sslmode=require.
  allowed_cidr_blocks         = var.db_allowed_cidr_blocks
  alarm_topic_arn             = aws_sns_topic.alerts.arn
  alarm_connections_threshold = 40
  connection_limit            = var.db_connection_limit
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
  #
  # Auth model (see apps/web/lib/auth.ts): admins log in with ADMIN_USER/
  # ADMIN_PASSWORD; restaurants log in against their bcrypt password in the DB.
  # There is no RESTAURANT_USER/PASSWORD env var anymore — that was the old
  # HTTP Basic Auth MVP and the app no longer reads it.
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

  # Custom domain: app.pedidoscloud.com for the app, staging.pedidoscloud.com kept.
  # www.pedidoscloud.com is intentionally excluded — it serves the landing page
  # (Cloudflare Pages) and must NOT point to Amplify.
  custom_domain     = "pedidoscloud.com"
  custom_subdomains = ["app", "staging"]

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
