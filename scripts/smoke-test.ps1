<#
.SYNOPSIS
    Atlas deployment smoke test.

.DESCRIPTION
    Verifies the edge/frontend route, backend health endpoints, and Atlas Metrics
    scrape output for a deployed Atlas environment. By default it targets a local
    Compose stack and reads .env for the nginx and metrics ports when available.

.EXAMPLE
    powershell -File .\scripts\smoke-test.ps1

.EXAMPLE
    powershell -File .\scripts\smoke-test.ps1 -EdgeBaseUrl https://atlas.example.com -MetricsBaseUrl https://metrics.atlas.example.com
#>
[CmdletBinding()]
param(
    [string]$EnvFile = ".env",
    [Alias('PublicBaseUrl')]
    [string]$EdgeBaseUrl,
    [string]$MetricsBaseUrl,
    [string]$FrontendUrl,
    [string]$EdgeHealthUrl,
    [string]$CoreHealthUrl,
    [string]$ContentHealthUrl,
    [string]$IntelHealthUrl,
    [string]$MetricsHealthUrl,
    [string]$MetricsUrl,
    [int]$TimeoutSeconds = 10,
    [switch]$AllowInsecureTls
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:InvokeWebRequestParameters = (Get-Command Invoke-WebRequest).Parameters
$script:OriginalCertificateCallback = $null
$script:UsedLegacyCertificateBypass = $false

function Get-EnvMap {
    param([string]$Path)

    $values = @{}
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }

        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $values[$key] = $value
    }

    return $values
}

function Resolve-LocalBaseUrl {
    param(
        [string]$Port,
        [string]$Scheme = 'http'
    )

    if ([string]::IsNullOrWhiteSpace($Port) -or $Port -eq '80') {
        return "${Scheme}://localhost"
    }

    if (($Scheme -eq 'https' -and $Port -eq '443') -or ($Scheme -eq 'http' -and $Port -eq '80')) {
        return "${Scheme}://localhost"
    }

    return "${Scheme}://localhost:$Port"
}

function Join-Url {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $BaseUrl
    }

    if ($Path -match '^https?://') {
        return $Path
    }

    return ('{0}/{1}' -f $BaseUrl.TrimEnd('/'), $Path.TrimStart('/'))
}

function Get-HeaderValue {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Response.Headers) {
        return $null
    }

    foreach ($headerName in $Response.Headers.Keys) {
        if ($headerName -ieq $Name) {
            $value = $Response.Headers[$headerName]
            if ($value -is [System.Array]) {
                return ($value -join ', ')
            }

            return [string]$value
        }
    }

    return $null
}

function ConvertFrom-JsonSafe {
    param([string]$Content)

    if ([string]::IsNullOrWhiteSpace($Content)) {
        throw 'Response body was empty.'
    }

    return $Content | ConvertFrom-Json
}

function Enable-InsecureTlsIfRequested {
    param([switch]$Requested)

    if (-not $Requested) {
        return
    }

    if ($script:InvokeWebRequestParameters.ContainsKey('SkipCertificateCheck')) {
        return
    }

    $script:OriginalCertificateCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    $script:UsedLegacyCertificateBypass = $true
}

function Restore-InsecureTlsState {
    if ($script:UsedLegacyCertificateBypass) {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $script:OriginalCertificateCallback
    }
}

function Invoke-SmokeRequest {
    param([Parameter(Mandatory = $true)][string]$Uri)

    $requestParameters = @{
        Uri        = $Uri
        Method     = 'GET'
        TimeoutSec = $TimeoutSeconds
        Headers    = @{ 'User-Agent' = 'atlas-smoke-test/1.0' }
    }

    if ($script:InvokeWebRequestParameters.ContainsKey('UseBasicParsing')) {
        $requestParameters.UseBasicParsing = $true
    }

    if ($AllowInsecureTls -and $script:InvokeWebRequestParameters.ContainsKey('SkipCertificateCheck')) {
        $requestParameters.SkipCertificateCheck = $true
    }

    return Invoke-WebRequest @requestParameters
}

function Assert-JsonStatus {
    param(
        [Parameter(Mandatory = $true)]$Json,
        [Parameter(Mandatory = $true)][string]$ExpectedStatus,
        [string]$PropertyPath = 'status'
    )

    $current = $Json
    foreach ($segment in $PropertyPath.Split('.')) {
        if ($null -eq $current) {
            throw "JSON response did not contain property '$PropertyPath'."
        }

        if ($null -eq $current.PSObject.Properties[$segment]) {
            throw "JSON response did not contain property '$PropertyPath'."
        }

        $current = $current.$segment
    }

    if ([string]$current -ne $ExpectedStatus) {
        throw "Expected $PropertyPath='$ExpectedStatus' but received '$current'."
    }

    return "$PropertyPath=$current"
}

function Assert-JsonStatusAnyPath {
    param(
        [Parameter(Mandatory = $true)]$Json,
        [Parameter(Mandatory = $true)][string]$ExpectedStatus,
        [Parameter(Mandatory = $true)][string[]]$PropertyPaths
    )

    $errors = @()
    foreach ($propertyPath in $PropertyPaths) {
        try {
            return Assert-JsonStatus -Json $Json -ExpectedStatus $ExpectedStatus -PropertyPath $propertyPath
        }
        catch {
            $errors += $_.Exception.Message
        }
    }

    throw ($errors -join ' | ')
}

function Assert-FrontendHtml {
    param([Parameter(Mandatory = $true)]$Response)

    $contentType = Get-HeaderValue -Response $Response -Name 'Content-Type'
    if ([string]::IsNullOrWhiteSpace($contentType) -or $contentType -notmatch 'text/html') {
        throw "Expected a text/html response but received '$contentType'."
    }

    if ([string]::IsNullOrWhiteSpace($Response.Content)) {
        throw 'Frontend response body was empty.'
    }

    return "content-type=$contentType"
}

function Assert-MetricsPayload {
    param([Parameter(Mandatory = $true)]$Response)

    $contentType = Get-HeaderValue -Response $Response -Name 'Content-Type'
    if ([string]::IsNullOrWhiteSpace($contentType) -or $contentType -notmatch 'text/plain') {
        throw "Expected a Prometheus text response but received '$contentType'."
    }

    $body = [string]$Response.Content
    $requiredPatterns = @(
        'atlas_metrics_last_refresh_success\s+1(?:\.0+)?',
        'atlas_service_up\{service="core"',
        'atlas_service_up\{service="content"',
        'atlas_service_up\{service="intel"'
    )

    foreach ($pattern in $requiredPatterns) {
        if ($body -notmatch $pattern) {
            throw "Metrics payload did not contain required pattern '$pattern'."
        }
    }

    $downChecks = [regex]::Matches($body, 'atlas_service_up\{[^}]+\}\s+0(?:\.0+)?')
    if ($downChecks.Count -gt 0) {
        $details = ($downChecks | ForEach-Object { $_.Value }) -join '; '
        throw "Metrics reported an unhealthy downstream dependency: $details"
    }

    return 'prometheus scrape healthy'
}

$envValues = Get-EnvMap -Path $EnvFile

if (-not $PSBoundParameters.ContainsKey('EdgeBaseUrl')) {
    $edgePort = if ([string]::IsNullOrWhiteSpace($envValues['NGINX_PORT'])) { '80' } else { $envValues['NGINX_PORT'] }
    $EdgeBaseUrl = Resolve-LocalBaseUrl -Port $edgePort
}

if (-not $PSBoundParameters.ContainsKey('MetricsBaseUrl')) {
    $metricsPort = if ([string]::IsNullOrWhiteSpace($envValues['ATLAS_METRICS_PORT'])) { '9090' } else { $envValues['ATLAS_METRICS_PORT'] }
    $MetricsBaseUrl = Resolve-LocalBaseUrl -Port $metricsPort
}

if ([string]::IsNullOrWhiteSpace($FrontendUrl)) {
    $FrontendUrl = $EdgeBaseUrl.TrimEnd('/')
}
if ([string]::IsNullOrWhiteSpace($EdgeHealthUrl)) {
    $EdgeHealthUrl = Join-Url -BaseUrl $EdgeBaseUrl -Path '/healthz'
}
if ([string]::IsNullOrWhiteSpace($CoreHealthUrl)) {
    $CoreHealthUrl = Join-Url -BaseUrl $EdgeBaseUrl -Path '/api/core/health'
}
if ([string]::IsNullOrWhiteSpace($ContentHealthUrl)) {
    $ContentHealthUrl = Join-Url -BaseUrl $EdgeBaseUrl -Path '/api/content/health'
}
if ([string]::IsNullOrWhiteSpace($IntelHealthUrl)) {
    $IntelHealthUrl = Join-Url -BaseUrl $EdgeBaseUrl -Path '/api/intel/health'
}
if ([string]::IsNullOrWhiteSpace($MetricsHealthUrl)) {
    $MetricsHealthUrl = Join-Url -BaseUrl $MetricsBaseUrl -Path '/healthz'
}
if ([string]::IsNullOrWhiteSpace($MetricsUrl)) {
    $MetricsUrl = Join-Url -BaseUrl $MetricsBaseUrl -Path '/metrics'
}

$checks = @(
    [pscustomobject]@{
        Name     = 'Edge health'
        Url      = $EdgeHealthUrl
        Validate = {
            param($response)
            $json = ConvertFrom-JsonSafe -Content $response.Content
            $detail = Assert-JsonStatus -Json $json -ExpectedStatus 'healthy'
            if ($null -ne $json.PSObject.Properties['service'] -and [string]$json.service -ne 'nginx') {
                throw "Expected edge service='nginx' but received '$($json.service)'."
            }
            return $detail
        }
    }
    [pscustomobject]@{
        Name     = 'Frontend route'
        Url      = $FrontendUrl
        Validate = {
            param($response)
            return Assert-FrontendHtml -Response $response
        }
    }
    [pscustomobject]@{
        Name     = 'Core health'
        Url      = $CoreHealthUrl
        Validate = {
            param($response)
            $json = ConvertFrom-JsonSafe -Content $response.Content
            return Assert-JsonStatus -Json $json -ExpectedStatus 'healthy'
        }
    }
    [pscustomobject]@{
        Name     = 'Content health'
        Url      = $ContentHealthUrl
        Validate = {
            param($response)
            $json = ConvertFrom-JsonSafe -Content $response.Content
            return Assert-JsonStatus -Json $json -ExpectedStatus 'healthy'
        }
    }
    [pscustomobject]@{
        Name     = 'Intel health'
        Url      = $IntelHealthUrl
        Validate = {
            param($response)
            $json = ConvertFrom-JsonSafe -Content $response.Content
            return Assert-JsonStatusAnyPath -Json $json -ExpectedStatus 'healthy' -PropertyPaths @('status', 'data.status')
        }
    }
    [pscustomobject]@{
        Name     = 'Atlas Metrics health'
        Url      = $MetricsHealthUrl
        Validate = {
            param($response)
            $json = ConvertFrom-JsonSafe -Content $response.Content
            return Assert-JsonStatus -Json $json -ExpectedStatus 'ok'
        }
    }
    [pscustomobject]@{
        Name     = 'Atlas Metrics scrape'
        Url      = $MetricsUrl
        Validate = {
            param($response)
            return Assert-MetricsPayload -Response $response
        }
    }
)

$results = New-Object System.Collections.Generic.List[object]

Write-Host ''
Write-Host 'Atlas deployment smoke test' -ForegroundColor Cyan
Write-Host ('=' * 28) -ForegroundColor DarkGray
Write-Host "Edge base URL:    $EdgeBaseUrl"
Write-Host "Metrics base URL: $MetricsBaseUrl"
Write-Host "Timeout:          $TimeoutSeconds s"
Write-Host ''

Enable-InsecureTlsIfRequested -Requested:$AllowInsecureTls

try {
    foreach ($check in $checks) {
        $started = Get-Date

        try {
            $response = Invoke-SmokeRequest -Uri $check.Url
            $detail = & $check.Validate $response
            $elapsedMs = [Math]::Round(((Get-Date) - $started).TotalMilliseconds, 0)
            $results.Add([pscustomobject]@{
                    Name      = $check.Name
                    Url       = $check.Url
                    Passed    = $true
                    Detail    = $detail
                    ElapsedMs = $elapsedMs
                }) | Out-Null

            Write-Host ('[PASS] {0} ({1} ms) -> {2}' -f $check.Name, $elapsedMs, $detail) -ForegroundColor Green
        }
        catch {
            $elapsedMs = [Math]::Round(((Get-Date) - $started).TotalMilliseconds, 0)
            $results.Add([pscustomobject]@{
                    Name      = $check.Name
                    Url       = $check.Url
                    Passed    = $false
                    Detail    = $_.Exception.Message
                    ElapsedMs = $elapsedMs
                }) | Out-Null

            Write-Host ('[FAIL] {0} ({1} ms) -> {2}' -f $check.Name, $elapsedMs, $_.Exception.Message) -ForegroundColor Red
        }
    }
}
finally {
    Restore-InsecureTlsState
}

$passedCount = ($results | Where-Object Passed).Count
$failed = @($results | Where-Object { -not $_.Passed })

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
Write-Host '-------' -ForegroundColor DarkGray
Write-Host ('Passed: {0}/{1}' -f $passedCount, $results.Count)

if ($failed.Count -gt 0) {
    Write-Host ('Failed: {0}' -f $failed.Count) -ForegroundColor Red
    foreach ($failure in $failed) {
        Write-Host (' - {0}: {1} [{2}]' -f $failure.Name, $failure.Detail, $failure.Url) -ForegroundColor Red
    }

    exit 1
}

Write-Host 'All Atlas smoke checks passed.' -ForegroundColor Green
exit 0
