# AWS Amplify Hosting app connected to GitHub, building the Next.js SSR app.
#
# The build spec lives in the repo (amplify.yml at the root, monorepo appRoot
# = apps/web), so we don't inline build_spec here. Platform WEB_COMPUTE enables
# Next.js server-side rendering / Server Actions on Amplify's managed compute.

resource "aws_amplify_app" "this" {
  name         = var.name
  repository   = var.repository_url
  access_token = var.github_access_token
  platform     = "WEB_COMPUTE"

  # AMPLIFY_MONOREPO_APP_ROOT must live at the APP level.
  # Amplify reads it during repo checkout — before branch-level vars are loaded —
  # to locate package.json. All other vars go to the branch (see below).
  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = var.monorepo_app_root
  }

  # Next.js SPA-style rewrite so client-side routes resolve. Amplify adds the
  # SSR routing automatically for WEB_COMPUTE; this is a safe catch-all.
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }

  # NOTE: Amplify WEB_COMPUTE VPC connectivity (vpc_config) is not yet supported
  # by the Terraform AWS provider. Configure it manually via the Amplify console:
  # App settings → Build settings → VPC configuration. The security groups and
  # VPC resources are created by the staging/prod env Terraform and are ready to
  # be associated here once Terraform provider support lands.

  tags = var.tags

  lifecycle {
    # Avoid churn if the token is rotated outside Terraform.
    ignore_changes = [access_token]
  }
}

resource "aws_amplify_domain_association" "this" {
  count       = var.custom_domain != "" ? 1 : 0
  app_id      = aws_amplify_app.this.id
  domain_name = var.custom_domain

  # One sub_domain block per subdomain, all pointing to this branch.
  dynamic "sub_domain" {
    for_each = var.custom_subdomains
    content {
      branch_name = aws_amplify_branch.this.branch_name
      prefix      = sub_domain.value
    }
  }

  # Let Amplify manage the SSL certificate (same as current setup).
  enable_auto_sub_domain = false
}

resource "aws_amplify_branch" "this" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.branch_name
  framework   = "Next.js - SSR"
  stage       = var.branch_stage

  enable_auto_build = var.enable_auto_build

  # All runtime vars go at the BRANCH level so they reach the SSR compute.
  # AMPLIFY_MONOREPO_APP_ROOT is intentionally excluded — it lives at app level.
  environment_variables = var.environment_variables

  tags = var.tags
}
