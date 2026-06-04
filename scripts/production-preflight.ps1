[CmdletBinding()]
param(
    [string]$Environment = "production",

    [ValidateSet("credit-saver", "lightsail", "ec2-compose", "full")]
    [string]$TerraformProfile = "lightsail",

    [switch]$DeployComposeHost,

    [switch]$DeployKubernetesApp,

    [switch]$AllowDirtyWorktree,

    [switch]$SkipToolChecks
)

$ErrorActionPreference = "Stop"

$script:Failures = New-Object System.Collections.Generic.List[string]
$script:Warnings = New-Object System.Collections.Generic.List[string]

function Write-Check {
    param(
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Status,
        [string]$Kind,
        [string]$Name,
        [string]$Message
    )

    $line = "[{0}] {1}: {2} - {3}" -f $Status, $Kind, $Name, $Message
    Write-Host $line

    if ($Status -eq "FAIL") {
        $script:Failures.Add($line) | Out-Null
    }
    elseif ($Status -eq "WARN") {
        $script:Warnings.Add($line) | Out-Null
    }
}

function Test-Tool {
    param(
        [string]$Name,
        [bool]$Required = $true
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        Write-Check "PASS" "tool" $Name "found at $($command.Source)"
    }
    elseif ($Required) {
        Write-Check "FAIL" "tool" $Name "required for local production preflight"
    }
    else {
        Write-Check "WARN" "tool" $Name "optional tool was not found"
    }
}

function Invoke-GhJson {
    param(
        [string[]]$Arguments,
        [string]$Description
    )

    $output = & gh @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Check "WARN" "github" $Description "could not read with gh; treating as empty"
        return @()
    }

    $json = ($output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($json)) {
        return @()
    }

    try {
        return @($json | ConvertFrom-Json)
    }
    catch {
        Write-Check "WARN" "github" $Description "returned invalid JSON; treating as empty"
        return @()
    }
}

function New-NameSet {
    param([object[]]$Items)

    $set = @{}
    foreach ($item in @($Items)) {
        if ($null -eq $item) {
            continue
        }

        $nameProperty = $item.PSObject.Properties["name"]
        if ($nameProperty -and -not [string]::IsNullOrWhiteSpace([string]$nameProperty.Value)) {
            $set[[string]$nameProperty.Value] = $true
        }
    }

    return $set
}

function New-ValueMap {
    param([object[]]$Items)

    $map = @{}
    foreach ($item in @($Items)) {
        if ($null -eq $item) {
            continue
        }

        $nameProperty = $item.PSObject.Properties["name"]
        $valueProperty = $item.PSObject.Properties["value"]
        if ($nameProperty -and -not [string]::IsNullOrWhiteSpace([string]$nameProperty.Value)) {
            $map[[string]$nameProperty.Value] = if ($valueProperty) { [string]$valueProperty.Value } else { "" }
        }
    }

    return $map
}

function Test-SetContains {
    param(
        [hashtable]$Set,
        [string]$Name
    )

    return $Set.ContainsKey($Name)
}

function Get-GitHubVariableValue {
    param([string[]]$Names)

    foreach ($name in $Names) {
        if ($script:VariableValues.ContainsKey($name)) {
            return $script:VariableValues[$name]
        }
    }

    return $null
}

function Test-EmptyCidrListValue {
    param([string]$Value)

    return [string]::IsNullOrWhiteSpace($Value) -or $Value.Trim() -eq "[]"
}

function Test-DnsHostnameValue {
    param([string]$Value)

    return -not [string]::IsNullOrWhiteSpace($Value) -and $Value -match '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -and $Value -notmatch '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

function Test-EmailValue {
    param([string]$Value)

    return -not [string]::IsNullOrWhiteSpace($Value) -and $Value -match '^[^@]+@[^@]+\.[^@]+$'
}

function Test-GitHubName {
    param(
        [ValidateSet("variable", "secret", "variable-or-secret")]
        [string]$Kind,
        [string[]]$Names,
        [string]$Reason,
        [switch]$WarningOnly
    )

    $found = @()
    foreach ($name in $Names) {
        if (($Kind -eq "variable" -or $Kind -eq "variable-or-secret") -and (Test-SetContains $script:VariableNames $name)) {
            $found += $name
        }
        elseif (($Kind -eq "secret" -or $Kind -eq "variable-or-secret") -and (Test-SetContains $script:SecretNames $name)) {
            $found += $name
        }
    }

    $displayName = $Names -join " or "
    if ($found.Count -gt 0) {
        Write-Check "PASS" $Kind $displayName "$Reason (found: $($found -join ', '))"
    }
    elseif ($WarningOnly) {
        Write-Check "WARN" $Kind $displayName $Reason
    }
    else {
        Write-Check "FAIL" $Kind $displayName $Reason
    }
}

function Test-LocalEnvironmentHint {
    if ($env:SENTRY_AUTH_TOKEN) {
        Write-Check "PASS" "sentry" "SENTRY_AUTH_TOKEN" "local token is present for live Sentry issue/event inspection"
    }
    else {
        Write-Check "WARN" "sentry" "SENTRY_AUTH_TOKEN" "not required for deploy; set locally only when you want to inspect live Sentry issues from this machine"
    }
}

function Test-GitWorktreeClean {
    $status = & git status --porcelain=v1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Check "FAIL" "git" "working-tree" "could not inspect local git status"
        return
    }

    $changed = @($status | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($changed.Count -eq 0) {
        Write-Check "PASS" "git" "working-tree" "clean release scope"
        return
    }

    if ($AllowDirtyWorktree) {
        Write-Check "WARN" "git" "working-tree" "$($changed.Count) local path(s) changed; release operator explicitly allowed a dirty worktree"
    }
    else {
        Write-Check "FAIL" "git" "working-tree" "$($changed.Count) local path(s) changed; commit/stash/review scope before production deploy"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$exitCode = 0

Push-Location $repoRoot
try {
    Write-Host "Scope production preflight"
    Write-Host "Repository: $repoRoot"
    Write-Host "Environment: $Environment"
    Write-Host "Terraform profile: $TerraformProfile"
    Write-Host "Deploy Compose host: $([bool]$DeployComposeHost)"
    Write-Host "Deploy Kubernetes app: $([bool]$DeployKubernetesApp)"
    Write-Host "Allow dirty worktree: $([bool]$AllowDirtyWorktree)"
    Write-Host ""

    if (-not $SkipToolChecks) {
        Test-Tool "git"
        Test-Tool "gh"
        Test-Tool "terraform"
        Test-Tool "docker"
        Test-Tool "dotnet" $false
        Test-Tool "py" $false
    }

    Test-GitWorktreeClean

    $ghAuth = & gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Check "PASS" "github" "auth" "gh is authenticated"
    }
    else {
        Write-Check "FAIL" "github" "auth" "gh is not authenticated or cannot reach GitHub"
    }

    $repoInfoOutput = & gh repo view --json nameWithOwner 2>&1
    if ($LASTEXITCODE -eq 0) {
        $repoInfo = ($repoInfoOutput -join "`n") | ConvertFrom-Json
        Write-Check "PASS" "github" "repository" "checking $($repoInfo.nameWithOwner)"
    }
    else {
        Write-Check "FAIL" "github" "repository" "could not resolve the current GitHub repository"
    }

    $repoVariables = Invoke-GhJson @("variable", "list", "--json", "name,value") "repository variables"
    $envVariables = Invoke-GhJson @("variable", "list", "--env", $Environment, "--json", "name,value") "environment '$Environment' variables"
    $repoSecrets = Invoke-GhJson @("secret", "list", "--json", "name") "repository secrets"
    $envSecrets = Invoke-GhJson @("secret", "list", "--env", $Environment, "--json", "name") "environment '$Environment' secrets"

    $script:VariableNames = New-NameSet (@($repoVariables) + @($envVariables))
    $script:VariableValues = New-ValueMap (@($repoVariables) + @($envVariables))
    $script:SecretNames = New-NameSet (@($repoSecrets) + @($envSecrets))

    Write-Host ""
    Write-Host "GitHub deployment inputs"
    Test-GitHubName "variable" @("AWS_ROLE_TO_ASSUME") "required by Terraform and Compose deploy AWS auth"
    Test-GitHubName "variable" @("TF_STATE_BUCKET") "required so Terraform uses the remote state bucket"
    Test-GitHubName "variable" @("TF_PHOTOS_BUCKET_NAME") "required by the shared Terraform foundation"
    Test-GitHubName "variable" @("TF_COGNITO_DOMAIN_PREFIX") "required by the shared Terraform foundation"
    Test-GitHubName "variable" @("TF_AWS_REGION") "optional; workflow defaults to us-east-1 when missing" -WarningOnly

    switch ($TerraformProfile) {
        "lightsail" {
            Test-GitHubName "variable" @("LIGHTSAIL_KEY_PAIR_NAME") "required when terraform_profile=lightsail"
            Test-GitHubName "variable" @("LIGHTSAIL_SSH_PUBLIC_KEY") "required when terraform_profile=lightsail"
            if ($DeployComposeHost) {
                $dynamicRunnerSsh = Get-GitHubVariableValue @("LIGHTSAIL_DYNAMIC_RUNNER_SSH")
                if ([string]::IsNullOrWhiteSpace($dynamicRunnerSsh)) {
                    $dynamicRunnerSsh = "true"
                }

                if ($dynamicRunnerSsh.Trim().ToLowerInvariant() -eq "true") {
                    Write-Check "PASS" "variable" "LIGHTSAIL_DYNAMIC_RUNNER_SSH" "dynamic runner SSH is enabled; Terraform can keep Lightsail SSH closed at rest"
                }
                else {
                    Test-GitHubName "variable" @("LIGHTSAIL_ADMIN_IPV4_CIDRS", "LIGHTSAIL_ADMIN_IPV6_CIDRS") "required so SSH is explicitly allowlisted for single-host deploy when dynamic runner SSH is disabled"
                    $lightsailIpv4Cidrs = Get-GitHubVariableValue @("LIGHTSAIL_ADMIN_IPV4_CIDRS")
                    $lightsailIpv6Cidrs = Get-GitHubVariableValue @("LIGHTSAIL_ADMIN_IPV6_CIDRS")
                    if ((Test-EmptyCidrListValue $lightsailIpv4Cidrs) -and (Test-EmptyCidrListValue $lightsailIpv6Cidrs)) {
                        Write-Check "FAIL" "variable-value" "LIGHTSAIL_ADMIN_*" "static Lightsail SSH allowlists cannot be empty when LIGHTSAIL_DYNAMIC_RUNNER_SSH is disabled"
                    }
                }
            }
        }
        "ec2-compose" {
            Test-GitHubName "variable" @("EC2_COMPOSE_KEY_PAIR_NAME", "LIGHTSAIL_KEY_PAIR_NAME") "required when terraform_profile=ec2-compose"
            Test-GitHubName "variable" @("EC2_COMPOSE_SSH_PUBLIC_KEY", "LIGHTSAIL_SSH_PUBLIC_KEY") "required when terraform_profile=ec2-compose"
            if ($DeployComposeHost) {
                Test-GitHubName "variable" @("EC2_COMPOSE_ADMIN_IPV4_CIDRS") "required so SSH is explicitly allowlisted for EC2 Compose deploy"
                $ec2ComposeCidrs = Get-GitHubVariableValue @("EC2_COMPOSE_ADMIN_IPV4_CIDRS")
                if (Test-EmptyCidrListValue $ec2ComposeCidrs) {
                    Write-Check "FAIL" "variable-value" "EC2_COMPOSE_ADMIN_IPV4_CIDRS" "EC2 Compose SSH allowlist cannot be empty when deploy_lightsail_app=true"
                }
            }
        }
        "full" {
            Test-GitHubName "secret" @("TF_SQLSERVER_MASTER_PASSWORD") "required when terraform_profile=full"
            Test-GitHubName "variable" @("SQLSERVER_ENGINE") "optional; workflow defaults to sqlserver-se for production Multi-AZ support" -WarningOnly
            Test-GitHubName "variable" @("SQLSERVER_INSTANCE_CLASS") "optional; workflow defaults to db.m6i.large for the full RDS profile" -WarningOnly
            Test-GitHubName "variable" @("SQLSERVER_MULTI_AZ") "optional; workflow defaults full-stack SQL Server Multi-AZ to true" -WarningOnly
            $eksPublicAccess = Get-GitHubVariableValue @("EKS_ENDPOINT_PUBLIC_ACCESS")
            if ($eksPublicAccess -and $eksPublicAccess.Trim().ToLowerInvariant() -eq "true") {
                Test-GitHubName "variable" @("EKS_PUBLIC_ACCESS_CIDRS") "required when EKS public API endpoint access is enabled"
                $eksCidrs = Get-GitHubVariableValue @("EKS_PUBLIC_ACCESS_CIDRS")
                if ((Test-EmptyCidrListValue $eksCidrs) -or ($eksCidrs -match '0\.0\.0\.0/0')) {
                    Write-Check "FAIL" "variable-value" "EKS_PUBLIC_ACCESS_CIDRS" "production EKS API allowlist must be narrow and must not include 0.0.0.0/0"
                }
            }
            else {
                Write-Check "PASS" "variable" "EKS_ENDPOINT_PUBLIC_ACCESS" "EKS API endpoint remains private by default"
            }
        }
    }

    if ($DeployComposeHost -and $TerraformProfile -notin @("lightsail", "ec2-compose")) {
        Write-Check "FAIL" "workflow" "deploy_lightsail_app" "Compose host deployment only applies to lightsail or ec2-compose profiles"
    }

    if ($DeployComposeHost) {
        Write-Host ""
        Write-Host "Compose host runtime inputs"
        Test-GitHubName "secret" @("SCOPE_SA_PASSWORD", "ATLAS_SA_PASSWORD") "required for SQL Server application password"
        Test-GitHubName "secret" @("SCOPE_CORE_JWT_SECRET", "CORE_JWT_SECRET", "ATLAS_CORE_JWT_SECRET") "required for Core JWT signing"
        Test-GitHubName "secret" @("SCOPE_DJANGO_SECRET_KEY", "DJANGO_SECRET_KEY", "ATLAS_DJANGO_SECRET_KEY") "required for Content/Django runtime"
        Test-GitHubName "secret" @("SCOPE_FLASK_SECRET_KEY", "FLASK_SECRET_KEY", "ATLAS_FLASK_SECRET_KEY") "required for Intel/Flask runtime"
        Test-GitHubName "secret" @("COMPOSE_HOST_SSH_PRIVATE_KEY", "LIGHTSAIL_SSH_PRIVATE_KEY") "required for SSH bundle upload and remote deployment"
        Test-GitHubName "variable" @("VITE_MAPBOX_TOKEN") "required for production map rendering"
        if ($TerraformProfile -eq "lightsail") {
            Test-GitHubName "secret" @("SCOPE_AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID") "required for Lightsail photo storage because Lightsail cannot attach the EC2 Compose instance role"
            Test-GitHubName "secret" @("SCOPE_AWS_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY") "required for Lightsail photo storage because Lightsail cannot attach the EC2 Compose instance role"
        }
        elseif ($TerraformProfile -eq "ec2-compose") {
            Write-Check "PASS" "aws" "EC2 Compose S3 access" "Terraform grants the EC2 instance role scoped access to the photos bucket"
        }

        if ($Environment -eq "production") {
            Write-Host ""
            Write-Host "Production-only runtime gates"
            Test-GitHubName "variable" @("SCOPE_TLS_HOSTNAME") "required for production trusted TLS certificate issuance"
            Test-GitHubName "variable" @("SCOPE_TLS_EMAIL") "required for Let's Encrypt ACME registration"
            $tlsHostname = Get-GitHubVariableValue @("SCOPE_TLS_HOSTNAME")
            $tlsEmail = Get-GitHubVariableValue @("SCOPE_TLS_EMAIL")
            if (-not (Test-DnsHostnameValue $tlsHostname)) {
                Write-Check "FAIL" "variable-value" "SCOPE_TLS_HOSTNAME" "must be a DNS hostname, not localhost or an IP address"
            }
            if (-not (Test-EmailValue $tlsEmail)) {
                Write-Check "FAIL" "variable-value" "SCOPE_TLS_EMAIL" "must be a valid ACME registration email"
            }
            Test-GitHubName "secret" @("SCOPE_GRPC_INTERNAL_TOKEN", "GRPC_INTERNAL_TOKEN") "required for internal gRPC auth; value must be at least 32 random characters"
            Test-GitHubName "secret" @("SCOPE_SENTRY_DSN", "SENTRY_DSN") "required for server-side Sentry coverage"
            Test-GitHubName "variable-or-secret" @("VITE_SENTRY_DSN") "required for browser-side Sentry coverage"
            if ((Test-SetContains $script:SecretNames "SCOPE_CONTENT_SENTRY_DSN") -or (Test-SetContains $script:SecretNames "CONTENT_SENTRY_DSN")) {
                Test-GitHubName "secret" @("SCOPE_CONTENT_SENTRY_DSN", "CONTENT_SENTRY_DSN") "optional separate Content Sentry project"
            }
            else {
                Write-Check "PASS" "secret" "SCOPE_CONTENT_SENTRY_DSN or CONTENT_SENTRY_DSN" "Content falls back to the configured server Sentry DSN"
            }
            $sentryMode = Get-GitHubVariableValue @("SENTRY_DSN_MODE")
            if ($sentryMode -and $sentryMode.Trim().ToLowerInvariant() -eq "temporary-placeholder") {
                Write-Check "WARN" "observability" "SENTRY_DSN_MODE" "temporary placeholder DSNs are configured; rotate to real free Sentry project DSNs before relying on error monitoring"
            }
            Write-Check "WARN" "secret-value" "SCOPE_GRPC_INTERNAL_TOKEN length" "GitHub does not expose secret values; verify this is 32+ random characters before deployment"
            Write-Check "WARN" "secret-value" "Sentry DSNs" "GitHub does not expose secret values; verify server and browser DSNs point at production Sentry projects"
        }
    }

    if ($DeployKubernetesApp) {
        Write-Host ""
        Write-Host "Kubernetes runtime inputs"
        if ($TerraformProfile -ne "full") {
            Write-Check "FAIL" "workflow" "deploy_kubernetes_app" "Kubernetes deployment only applies to terraform_profile=full"
        }
        Test-GitHubName "variable" @("SCOPE_TLS_HOSTNAME") "required for Ingress host and cert-manager certificate"
        Test-GitHubName "variable" @("SCOPE_TLS_EMAIL") "required for cert-manager ACME registration"
        Test-GitHubName "secret" @("SCOPE_SA_PASSWORD", "ATLAS_SA_PASSWORD") "required for in-cluster SQL Server"
        Test-GitHubName "secret" @("SCOPE_CORE_JWT_SECRET", "CORE_JWT_SECRET", "ATLAS_CORE_JWT_SECRET") "required for Core JWT signing"
        Test-GitHubName "secret" @("SCOPE_GRPC_INTERNAL_TOKEN", "GRPC_INTERNAL_TOKEN") "required for internal gRPC auth"
        Test-GitHubName "secret" @("SCOPE_DJANGO_SECRET_KEY", "DJANGO_SECRET_KEY", "ATLAS_DJANGO_SECRET_KEY") "required for Content/Django runtime"
        Test-GitHubName "secret" @("SCOPE_FLASK_SECRET_KEY", "FLASK_SECRET_KEY", "ATLAS_FLASK_SECRET_KEY") "required for Intel/Flask runtime"
        Test-GitHubName "secret" @("SCOPE_GRAFANA_ADMIN_PASSWORD", "GRAFANA_ADMIN_PASSWORD") "required for Grafana admin login"
        Test-GitHubName "secret" @("SCOPE_WEB_PUSH_PRIVATE_KEY", "WEB_PUSH_PRIVATE_KEY") "required for Core push notification signing"
        Test-GitHubName "variable" @("SCOPE_WEB_PUSH_PUBLIC_KEY", "VITE_WEB_PUSH_PUBLIC_KEY") "required for browser push subscription setup"

        $tlsHostname = Get-GitHubVariableValue @("SCOPE_TLS_HOSTNAME")
        $tlsEmail = Get-GitHubVariableValue @("SCOPE_TLS_EMAIL")
        if (-not (Test-DnsHostnameValue $tlsHostname)) {
            Write-Check "FAIL" "variable-value" "SCOPE_TLS_HOSTNAME" "must be a DNS hostname for Kubernetes Ingress TLS"
        }
        if (-not (Test-EmailValue $tlsEmail)) {
            Write-Check "FAIL" "variable-value" "SCOPE_TLS_EMAIL" "must be a valid cert-manager ACME registration email"
        }
    }

    Write-Host ""
    Write-Host "Live observability access"
    Test-LocalEnvironmentHint

    Write-Host ""
    if ($script:Failures.Count -gt 0) {
        Write-Host "Result: BLOCKED - $($script:Failures.Count) required production input(s) missing or invalid."
        $exitCode = 1
    }
    else {
        Write-Host "Result: PASS - required production inputs are present for this profile."
    }

    if ($script:Warnings.Count -gt 0) {
        Write-Host "Warnings: $($script:Warnings.Count). Review them before production apply/deploy."
    }
}
finally {
    Pop-Location
}

exit $exitCode
