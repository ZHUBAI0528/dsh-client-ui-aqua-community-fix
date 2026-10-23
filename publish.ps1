# Publish the Aqua plugin to npm.
#
# package.json already carries the published shape (name, files, dsh.bundle,
# prepublishOnly), so publishing needs no staging copy — npm pack does the
# filtering. prepublishOnly rebuilds lib/ before the tarball is produced.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\publish.ps1 -DryRun   # inspect the tarball only
#   powershell -ExecutionPolicy Bypass -File .\publish.ps1           # build + publish

param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$name = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).name

Push-Location $root
try {
    if ($DryRun) {
        npm publish --dry-run
        return
    }
    npm publish
    if ($LASTEXITCODE -ne 0) { throw "npm publish failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

Write-Host ''
Write-Host ("Published " + $name + ". Install with:") -ForegroundColor Green
Write-Host ("  dsh plugin --profile web add " + $name) -ForegroundColor Cyan
