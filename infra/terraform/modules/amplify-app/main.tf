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

  # App-level env vars are inherited by every branch.
  environment_variables = var.environment_variables

  # Next.js SPA-style rewrite so client-side routes resolve. Amplify adds the
  # SSR routing automatically for WEB_COMPUTE; this is a safe catch-all.
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }

  tags = var.tags

  lifecycle {
    # Avoid churn if the token is rotated outside Terraform.
    ignore_changes = [access_token]
  }
}

resource "aws_amplify_branch" "this" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.branch_name
  framework   = "Next.js - SSR"
  stage       = var.branch_stage

  enable_auto_build = var.enable_auto_build

  tags = var.tags
}
