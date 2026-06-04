locals {
  credit_guard_expires_at = "${var.credit_guard_expires_on}T00:00:00Z"
  credit_guard_lightsail_data_disk_monthly_usd = (
    local.deploy_lightsail ? var.lightsail_data_disk_size_gib * 0.10 : 0
  )
  credit_guard_profile_monthly_usd = {
    "credit-saver" = var.credit_guard_credit_saver_monthly_usd
    lightsail      = var.credit_guard_lightsail_monthly_usd + local.credit_guard_lightsail_data_disk_monthly_usd
    "ec2-compose"  = var.credit_guard_ec2_compose_monthly_usd
    full           = var.credit_guard_full_monthly_usd
  }
  credit_guard_estimated_runtime_cost_usd = ceil((
    (
      lookup(local.credit_guard_profile_monthly_usd, local.stack_profile, var.credit_guard_full_monthly_usd) +
      var.credit_guard_addon_monthly_usd
    ) *
    var.credit_guard_runtime_days /
    30
  ) * 100) / 100
  credit_guard_total_monthly_usd = (
    lookup(local.credit_guard_profile_monthly_usd, local.stack_profile, var.credit_guard_full_monthly_usd) +
    var.credit_guard_addon_monthly_usd
  )
  credit_guard_budget_notifications = [
    {
      notification_type = "ACTUAL"
      threshold         = 75
    },
    {
      notification_type = "ACTUAL"
      threshold         = 90
    },
    {
      notification_type = "FORECASTED"
      threshold         = 95
    }
  ]
}

resource "terraform_data" "credit_guardrails" {
  input = {
    estimated_runtime_cost_usd = local.credit_guard_estimated_runtime_cost_usd
    addon_monthly_usd          = var.credit_guard_addon_monthly_usd
    addon_name                 = var.credit_guard_addon_name
    expires_on                 = var.credit_guard_expires_on
    limit_usd                  = var.credit_guard_limit_usd
    profile                    = local.stack_profile
    runtime_days               = var.credit_guard_runtime_days
  }

  lifecycle {
    precondition {
      condition     = !var.enforce_credit_guardrails || timecmp(local.credit_guard_expires_at, plantimestamp()) > 0
      error_message = "The Scope credit window expired on ${var.credit_guard_expires_on}. Set a new reviewed credit_guard_expires_on or disable enforce_credit_guardrails only after confirming billing controls."
    }

    precondition {
      condition     = !var.enforce_credit_guardrails || local.credit_guard_estimated_runtime_cost_usd <= var.credit_guard_limit_usd
      error_message = format("The selected %s profile is estimated at $%.2f, which exceeds the configured $%.2f credit guard.", local.stack_profile, local.credit_guard_estimated_runtime_cost_usd, var.credit_guard_limit_usd)
    }
  }
}

resource "aws_budgets_budget" "credit_guard" {
  count = var.enable_credit_guard_budget ? 1 : 0

  name              = "${local.name_prefix}-credit-guard"
  budget_type       = "COST"
  limit_amount      = tostring(var.credit_guard_limit_usd)
  limit_unit        = "USD"
  time_period_start = "${var.credit_guard_start_on}_00:00"
  time_period_end   = "${var.credit_guard_expires_on}_00:00"
  time_unit         = "ANNUALLY"

  cost_types {
    include_credit = false
  }

  dynamic "notification" {
    for_each = length(var.credit_guard_budget_subscriber_emails) > 0 ? local.credit_guard_budget_notifications : []

    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = notification.value.notification_type
      subscriber_email_addresses = var.credit_guard_budget_subscriber_emails
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
    }
  }
}
