output "app_id" {
  description = "Amplify app ID."
  value       = aws_amplify_app.this.id
}

output "default_domain" {
  description = "Amplify default domain (e.g. xxxx.amplifyapp.com)."
  value       = aws_amplify_app.this.default_domain
}

output "branch_url" {
  description = "Public URL of the deployed branch (point Cloudflare CNAME here)."
  value       = "https://${aws_amplify_branch.this.branch_name}.${aws_amplify_app.this.default_domain}"
}

output "branch_name" {
  description = "Deployed branch name."
  value       = aws_amplify_branch.this.branch_name
}
