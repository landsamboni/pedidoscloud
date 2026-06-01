# Optional AWS Secrets Manager secret.
#
# For the MVP the app reads configuration from Amplify environment variables, so
# this module is OFF by default (create = false). Enable it if you prefer to
# centralise secrets (DATABASE_URL, AWS keys) in Secrets Manager — you would
# then wire the app to read from it, or use it as the source of truth when
# populating Amplify env vars.

resource "aws_secretsmanager_secret" "this" {
  count                   = var.create ? 1 : 0
  name                    = var.name
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "this" {
  count         = var.create ? 1 : 0
  secret_id     = aws_secretsmanager_secret.this[0].id
  secret_string = jsonencode(var.secret_values)
}
