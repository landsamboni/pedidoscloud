# State backend.
#
# MVP default: LOCAL state (a terraform.tfstate file in this directory). That is
# fine for deploying manually from your laptop. The state file can contain
# secrets, so it is gitignored — keep it safe and back it up.
#
# When you want shared/remote state (recommended once more than one person
# deploys, or to add a pipeline later), create an S3 bucket + DynamoDB lock
# table once, then uncomment and fill in the block below and run:
#   terraform init -migrate-state
#
# terraform {
#   backend "s3" {
#     bucket         = "pedidoscloud-tfstate"
#     key            = "staging/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "pedidoscloud-tflock"
#     encrypt        = true
#   }
# }
