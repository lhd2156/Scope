mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["us-east-1a", "us-east-1b"]
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{}"
    }
  }
}

variables {
  environment                    = "production"
  stack_profile                  = "ec2-compose"
  photos_bucket_name             = "scope-rebuild-test-photos"
  cognito_domain_prefix          = "scope-rebuild-test"
  ec2_compose_key_pair_name      = "scope-rebuild-test"
  ec2_compose_ami_id             = "ami-0123456789abcdef0"
  ec2_compose_cpu_credits        = "standard"
  billing_guard_mode             = "monthly"
  monthly_budget_limit_usd       = 48
  credit_guard_addon_monthly_usd = 10.50
  credit_guard_expires_on        = "2020-01-01"
  enforce_credit_guardrails      = true
}

run "monthly_plan_survives_expired_promotional_window" {
  command = plan

  assert {
    condition     = output.credit_guard_total_monthly_estimate_usd == 48
    error_message = "The reviewed monthly estimate must include the reserve."
  }

  assert {
    condition     = length(aws_budgets_budget.monthly_guard) == 1 && length(aws_budgets_budget.credit_guard) == 0
    error_message = "Monthly mode must create an ongoing monthly budget."
  }

  assert {
    condition     = aws_budgets_budget.monthly_guard[0].time_unit == "MONTHLY" && aws_budgets_budget.monthly_guard[0].limit_amount == "48"
    error_message = "The destination budget must be $48 per month."
  }

  assert {
    condition     = aws_instance.ec2_compose[0].credit_specification[0].cpu_credits == "standard"
    error_message = "The rebuild must honor the explicit surplus-credit setting."
  }

  assert {
    condition     = one(aws_dlm_lifecycle_policy.ec2_compose_root[0].policy_details[0].schedule).copy_tags == false
    error_message = "Snapshot schedules must not duplicate explicitly added source tags."
  }

  assert {
    condition     = length(aws_eks_cluster.scope) == 0 && length(aws_nat_gateway.scope) == 0
    error_message = "The single-host plan must not provision the expensive full profile."
  }
}

run "reject_monthly_estimate_over_ceiling" {
  command = plan

  variables {
    credit_guard_addon_monthly_usd = 20
  }

  expect_failures = [terraform_data.credit_guardrails]
}

run "preserve_expired_credit_window_rejection" {
  command = plan

  variables {
    billing_guard_mode = "credit-window"
  }

  expect_failures = [terraform_data.credit_guardrails]
}
