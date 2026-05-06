# Generate gRPC code from proto definitions
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot

if (Test-Path gen) { Remove-Item -Recurse -Force gen }

$bufCommand = Get-Command buf -ErrorAction SilentlyContinue
if ($bufCommand) {
    $buf = $bufCommand.Source
} else {
    $toolsDir = Join-Path $PSScriptRoot ".tools"
    $buf = Join-Path $toolsDir "buf.exe"
    if (-not (Test-Path $buf)) {
        Write-Host "Installing buf..."
        New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
        Invoke-WebRequest `
            -Uri "https://github.com/bufbuild/buf/releases/latest/download/buf-Windows-x86_64.exe" `
            -OutFile $buf
    }
}

& $buf generate

Write-Host "Generated code in gen/"
Get-ChildItem gen -Recurse | Select-Object FullName

Pop-Location
