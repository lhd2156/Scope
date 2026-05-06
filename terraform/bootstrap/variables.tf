variable "aws_region" {
  description = "AWS region for the Terraform state bootstrap resources."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project slug used for naming Terraform state resources."
  type        = string
  default     = "scope"
}

variable "environment" {
  description = "Environment name appended to the Terraform state resources."
  type        = string
  default     = "staging"
}

variable "tags" {
  description = "Additional tags applied to the Terraform state bootstrap resources."
  type        = map(string)
  default     = {}
}
