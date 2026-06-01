# IAM user with programmatic access scoped to the uploads bucket only.
#
# MVP choice: Amplify Hosting's managed SSR compute role is awkward to extend
# from Terraform, so we hand the app a dedicated IAM user's access keys via
# Amplify environment variables. The policy is least-privilege (this one bucket).
# A later hardening step is to switch to the Amplify compute role + instance
# credentials and delete this user.

resource "aws_iam_user" "app" {
  name = var.name
  tags = var.tags
}

data "aws_iam_policy_document" "s3_access" {
  statement {
    sid       = "ObjectAccess"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.bucket_arn}/*"]
  }

  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.bucket_arn]
  }
}

resource "aws_iam_user_policy" "s3_access" {
  name   = "${var.name}-s3-access"
  user   = aws_iam_user.app.name
  policy = data.aws_iam_policy_document.s3_access.json
}

resource "aws_iam_access_key" "app" {
  user = aws_iam_user.app.name
}
