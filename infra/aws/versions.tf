terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Backend left commented; uncomment + customize after first `terraform init`
  # if you want shared remote state. For a single-user setup, local state in
  # this directory is fine.
  #
  # backend "s3" {
  #   bucket = "shortcutstudio-tfstate"
  #   key    = "infra/aws/terraform.tfstate"
  #   region = "us-east-1"
  # }
}
