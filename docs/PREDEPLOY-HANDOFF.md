# Scope Pre-Deploy Handoff

Last updated: April 23, 2026

This document captures what is already set up, what still needs a real account/login later, and how the Terraform deployment path is now split between a cheap default and an explicitly expensive full stack.

## Already handled

- Mapbox token is available and wired locally and in GitHub.
- AWS account access is working for account `277876299862`.
- Terraform remote state bootstrap exists:
  - S3 state bucket: `scope-staging-277876299862-tfstate`
  - DynamoDB lock table: `scope-staging-terraform-locks`
- GitHub OIDC deploy role exists:
  - `arn:aws:iam::277876299862:role/scope-github-actions-deploy`
- GitHub repo variables and secrets needed for the deploy workflow are set.
- A real staging Terraform plan succeeded in GitHub Actions.
- The low-cost `credit-saver` staging baseline is now applied in AWS.

## Current live staging baseline

- VPC: `vpc-093ec096ec41881c0`
- Public subnets:
  - `subnet-022ec6a9037114db7`
  - `subnet-063b9d615652c966a`
- Private subnets:
  - `subnet-0e940e9702e9594a7`
  - `subnet-0e83cbe66c7d2fb55`
- Photos bucket: `scope-staging-photos-277876299862`
- Cognito user pool: `us-east-1_BV3V7JqKV`
- Cognito app client: `1pd25623obhqm7osj7r51ir82e`
- Cognito domain: `scope-staging-277876299862`

## What is intentionally not running

- No EKS cluster
- No worker nodes
- No NAT gateway
- No public IPv4 for NAT
- No RDS SQL Server
- No ECR repositories

## No additional vendor signup needed right now

- Terraform
- Cognito
- Grafana
- Prometheus
- SQL Server on RDS
- Kafka / Zookeeper
- ECR
- S3

Those all come from AWS, not separate third-party account creation.

## Things to do later

### Security and account hygiene

- Move off the AWS root user for day-to-day work.
- Replace the placeholder `AdministratorAccess` policy on the GitHub OIDC deploy role with least-privilege IAM.
- Rotate the current Mapbox token after the app stabilizes.
- Rotate the generated app secrets:
  - `CORE_JWT_SECRET`
  - `DJANGO_SECRET_KEY`
  - `FLASK_SECRET_KEY`
  - `TF_SQLSERVER_MASTER_PASSWORD`
  - `GRAFANA_ADMIN_PASSWORD`

### Production-readiness

- Choose real public domains and DNS.
- Add TLS and certificate management for public endpoints.
- Decide whether to use Cognito hosted UI exactly as-is or customize auth flows.
- Add a real alert destination:
  - Slack
  - Discord
  - PagerDuty
  - custom webhook
- Add stricter environment protections in GitHub for `staging` and `production`.
- Add budgets and cost alerts in AWS.

## Terraform profiles

### Default: `credit-saver`

This is now the recommended staging profile when the goal is to stretch AWS credits.

It creates:

- 1 VPC
- 2 public subnets
- 2 private subnets
- 1 internet gateway
- 1 S3 photos bucket
- 1 Cognito user pool
- 1 Cognito app client
- 1 Cognito domain

It does not create:

- NAT gateway
- public IPv4 for NAT
- EKS cluster
- EKS worker nodes
- RDS SQL Server
- ECR repositories

That means the default apply has little to no fixed hourly baseline. Costs stay mostly usage-based:

- S3 storage, requests, and egress
- Cognito usage above free allowances

### Optional: `lightsail`

This is the new always-on middle path between the cheap foundation-only stack and the expensive full AWS runtime.

It adds:

- 1 Lightsail Linux instance
- 1 static public IP
- automatic daily snapshots
- public ports for SSH, HTTP, and HTTPS
- deploy workflow support for uploading the Scope source bundle over SSH and starting the Compose runtime

It still avoids:

- NAT gateway
- EKS cluster
- RDS SQL Server
- ECR repositories

This is the profile to use when you want Scope running all the time but do not want the EKS/RDS bill.

To use the automated app rollout after a Lightsail apply, the GitHub environment also needs:

- `LIGHTSAIL_KEY_PAIR_NAME`
- `LIGHTSAIL_SSH_PUBLIC_KEY`
- `LIGHTSAIL_SSH_PRIVATE_KEY`
- `SCOPE_SA_PASSWORD`
- `SCOPE_CORE_JWT_SECRET`
- `SCOPE_DJANGO_SECRET_KEY`
- `SCOPE_FLASK_SECRET_KEY`
- `VITE_MAPBOX_TOKEN`

### Optional: `full`

This is the original heavier stack and should be treated as an explicit opt-in.

It adds:

- 1 NAT gateway
- 1 public IPv4 for the NAT gateway
- 1 EKS cluster
- 1 EKS managed node group
- 1 RDS SQL Server Express instance
- 4 ECR repositories when `terraform_registry=ecr`

This is the profile where the real always-on AWS bill starts.

## Practical recommendation

If the goal is to make the initial AWS credits last 5-6 months:

- keep `terraform_profile=credit-saver`
- keep `terraform_registry=ghcr`
- do day-to-day work with local Docker Compose
- use GitHub Actions for CI and image publishing
- use `terraform_profile=lightsail` only when you are intentionally ready for an always-on VM bill
- delay `terraform_profile=full` until you specifically need managed Kubernetes and managed SQL Server

## Monthly cost snapshot

### `credit-saver`

Expected fixed baseline: effectively `$0-$5/month` when idle.

Real cost only starts to show up when you store photos in S3, move data out of AWS, or push Cognito usage past free allowances.

### `full`

Approximate always-on baseline in `us-east-1` before app traffic:

| Resource | Approx. monthly |
| --- | ---: |
| EKS control plane | `$73` |
| 2 x `t3.medium` worker nodes | `$61` |
| NAT gateway | `$33` |
| public IPv4 for NAT | `$4` |
| RDS SQL Server Express `db.t3.small` | `$32` |
| RDS storage (20 GiB gp3) | `$2` |
| **Baseline subtotal** | **`~$205/month`** |

Practical real-world staging range for the `full` profile is closer to `~$210-$260/month` after small amounts of logs, storage, requests, and data transfer.

### `lightsail`

Practical real-world staging range for the current default 8 GB Lightsail path is roughly `~$45-$50/month` once the instance is running continuously and you add a small amount of S3 usage.

### Important note

- The full-stack apply was started once, then canceled and rolled back after cost review.
- The expensive resources have been torn back down so credits are not currently bleeding.

## Notes

- The Terraform apply target should still be treated as a staging bootstrap, not a production deployment.
- The cheap profile is intentionally biased toward unblocking app integration work without turning on the expensive always-on infrastructure.
- When it is time to move to a full AWS runtime, the EKS/RDS path is still available behind the `full` profile.
