# State backend.
#
# MVP default: LOCAL state (terraform.tfstate in this directory). It contains
# secrets, so it is gitignored — keep it safe and back it up.
#
# Recommended for production: remote state in S3 with locking. Create the bucket
# + DynamoDB lock table once, then uncomment, fill in, and run:
#   terraform init -migrate-state
#
# terraform {
#   backend "s3" {
#     bucket         = "pedidoscloud-tfstate"
#     key            = "prod/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "pedidoscloud-tflock"
#     encrypt        = true
#   }
# }
