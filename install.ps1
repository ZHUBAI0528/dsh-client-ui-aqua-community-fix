# Aqua installer (Windows) - BACKUP method. The recommended install is the
# desktop app: left sidebar -> Plugins -> Add plugin -> enter
#   github:zhubai0528/dsh-client-ui-aqua-community-fix
#
# The package is also published to npm (@zhubai0528/dsh-client-ui-aqua-community-fix),
# so any platform with Node.js can install it in one command:
#
#   dsh plugin --profile web add @zhubai0528/dsh-client-ui-aqua-community-fix
#
# This script is the last-resort fallback: no npm, no git required.
#
# One command (from any directory):
#   powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
#
# It does three things:
#   1. get the repo (git clone, or plain zip download when git is missing)
#   2. create a junction in the profile's node_modules
#   3. register ui-aqua in cordis.patch.yml (idempotent - safe to re-run)
#
# Version: defaults to 'latest' (the newest GitHub Release, resolved via the
# API). Pin a version with -Version 'v1.0.1', or track the dev branch with
# -Version 'main'. Reload the Web UI afterwards. DSH home defaults to
# %USERPROFILE%\.dsh, override with -DshHome. Repo defaults to the official
# one; pass a URL or local path to install another clone.

param(
    [string]$Source = 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix',
    [string]$Version = 'latest',
    [string]$DshHome = $env:DSH_HOME,
    [string]$Profile = 'web'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Windows PowerShell 5.1 writes a UTF-8 BOM for `Set-Content -Encoding UTF8`.
# A BOM at the head of a JSON manifest makes V8's JSON.parse throw
# ("Unexpected token '\uFEFF'"), which aborts the DSH host at startup — so all
# file writes below go through .NET with an explicit no-BOM encoder.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8NoBom {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Text)
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

# Verify the bundle that is about to be linked into the profile.
#
# This script installs code from a GitHub snapshot, which is normally fetched
# as a plain archive with no signature. The repo publishes SHA256SUMS.txt
# (written by `npm run bundle`) covering lib/client.js — the one file the
# plugin actually executes — so the installer can compare the bytes it
# unpacked against the bytes the maintainer built.
#
# Policy: a MATCH is required, a MISSING manifest is not. Older releases and
# branch installs predate the manifest, and refusing them would break installs
# that work today; a MISMATCH always aborts, because that is either tampering
# or a corrupted download.
function Test-BundleChecksum {
    param(
        [Parameter(Mandatory)][string]$BundlePath,
        [Parameter(Mandatory)][string]$Slug,
        [Parameter(Mandatory)][string]$Ref
    )
    $url = "https://raw.githubusercontent.com/$Slug/$Ref/SHA256SUMS.txt"
    try {
        $manifest = (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 15).Content
    } catch {
        Write-Host "  (no SHA256SUMS.txt at $Ref - integrity check skipped)" -ForegroundColor DarkYellow
        return
    }
    $expected = $null
    foreach ($line in ($manifest -split "`n")) {
        $trim = $line.Trim()
        if (-not $trim) { continue }
        $parts = $trim -split '\s+', 2
        if ($parts.Count -lt 2) { continue }
        $path = $parts[1].TrimStart('*').Trim()
        if ($path -eq 'lib/client.js') { $expected = $parts[0].Trim().ToLower(); break }
    }
    if (-not $expected) {
        Write-Host '  (manifest has no entry for lib/client.js - integrity check skipped)' -ForegroundColor DarkYellow
        return
    }
    $actual = (Get-FileHash -Path $BundlePath -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        throw ("checksum mismatch for lib/client.js`n  expected $expected`n  actual   $actual`n" +
               'The download does not match the published build - aborting without installing.')
    }
    Write-Host "  integrity OK (sha256 $($actual.Substring(0, 12))...)" -ForegroundColor Green
}

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $DshHome)) { throw "DSH home not found: $DshHome (override with -DshHome)" }

$plugin      = '@zhubai0528/dsh-client-ui-aqua-community-fix'
$nodeModules = Join-Path $DshHome 'profiles\node_modules'
$linkPath    = Join-Path $nodeModules $plugin
$patchFile   = Join-Path $DshHome "profiles\$Profile\cordis.patch.yml"
# Persistent plugin location: %TEMP% can be wiped on reboot / disk cleanup,
# which would leave the junction dangling and break the next boot.
$pluginsDir  = Join-Path $DshHome 'plugins'
$cloneDir    = Join-Path $pluginsDir $plugin

# ---------- 1. source ----------
Write-Host '[1/3] Getting plugin source...' -ForegroundColor Cyan
$isRemote = $Source -match '^(https?://|git@|ssh://|github:)'
if ($isRemote) {
    $repoUrl = $Source.TrimEnd('/').TrimEnd('.git')
    # owner/repo slug, used for the release API and the checksum manifest.
    $slug = $null
    if ($repoUrl -match '^https?://github\.com/([^/]+/[^/]+)') { $slug = $Matches[1] }

    # Resolve the ref: 'latest' -> the newest release tag via the GitHub API;
    # a version-looking string (v1.2.3) is a tag; anything else is a branch.
    $ref = $Version
    $isTag = $ref -match '^v\d+\.\d+'
    if ($ref -eq 'latest' -and $slug) {
        try {
            $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$slug/releases/latest" -Headers @{ 'User-Agent' = 'dsh-aqua-installer' } -TimeoutSec 15
            if ($latest.tag_name) {
                $ref = $latest.tag_name
                $isTag = $true
                Write-Host "  最新版本: $ref" -ForegroundColor Cyan
            }
        } catch {
            Write-Host '  (查询最新版本失败，回退到 main 分支)' -ForegroundColor Yellow
            $ref = 'main'
            $isTag = $false
        }
    }

    # Zip first: plain HTTP is faster and more reliable than the git protocol
    # (the latter often stalls on flaky connections). git is only a fallback.
    $refKind  = if ($isTag) { 'tags' } else { 'heads' }
    $zipUrl   = "$repoUrl/archive/refs/$refKind/$ref.zip"
    $zipFile  = Join-Path $pluginsDir 'aqua-plugin.zip'
    $extractDir = Join-Path $pluginsDir 'aqua-plugin-extract'
    New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null

    $gotSource = $false
    try {
        Write-Host "  downloading $zipUrl"
        Invoke-WebRequest $zipUrl -OutFile $zipFile -UseBasicParsing
        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
        Expand-Archive $zipFile -DestinationPath $extractDir -Force
        $inner = Get-ChildItem $extractDir -Directory | Select-Object -First 1
        if (-not $inner) { throw "zip contains no package directory: $zipUrl" }
        if (Test-Path $cloneDir) { Remove-Item $cloneDir -Recurse -Force }
        # The plugin name is scoped (@deepseek-ai/...), so create the parent
        # level too - Move-Item cannot create multi-level destination paths.
        New-Item -ItemType Directory -Force -Path (Split-Path $cloneDir -Parent) | Out-Null
        Move-Item $inner.FullName $cloneDir
        Remove-Item $zipFile -Force
        $gotSource = $true
    } catch {
        Write-Host '  zip download failed, trying git clone...' -ForegroundColor Yellow
    }

    if (-not $gotSource) {
        $useGit = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
        if (-not $useGit) { throw 'download failed (zip and git both unavailable)' }
        if (Test-Path $cloneDir) { Remove-Item $cloneDir -Recurse -Force }
        git clone --depth 1 --branch $ref $repoUrl $cloneDir | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "git clone failed for $repoUrl ($ref)" }
    }
    $src = $cloneDir
} else {
    $src = (Resolve-Path $Source).Path
}
if (-not (Test-Path (Join-Path $src 'lib\client.js'))) {
    throw "lib\client.js not found - the repo must include the pre-built bundle. dir: $src"
}
if ($isRemote -and $slug) {
    Test-BundleChecksum -BundlePath (Join-Path $src 'lib\client.js') -Slug $slug -Ref $ref
}

# ---------- 1b. drop a stale legacy-name install ----------
# The package was published as `@zhubai0528/dsh-client-ui-aqua` before the
# "community fix" rename. Leaving that junction in place would register the
# same plugin id (ui-aqua) twice and make the loader refuse the roster.
$legacyName = '@zhubai0528/dsh-client-ui-aqua'
$legacyDirs = @(
    (Join-Path $DshHome ('profiles\\node_modules\\' + $legacyName)),
    (Join-Path $DshHome ('profiles\\' + $Profile + '\\node_modules\\' + $legacyName))
)
foreach ($legacy in $legacyDirs) {
    if (-not (Test-Path $legacy)) { continue }
    $item = Get-Item $legacy -Force
    if ($item.LinkType) {
        # Delete the junction itself, never its target (-Recurse would follow it).
        [System.IO.Directory]::Delete($legacy)
    } else {
        Remove-Item $legacy -Force -Recurse
    }
    Write-Host "  removed legacy install: $legacy" -ForegroundColor DarkGray
}

# ---------- 2. junction ----------
Write-Host "[2/3] Linking -> $linkPath" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $nodeModules | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $linkPath -Parent) | Out-Null
if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.LinkType) {
        # Delete the junction itself, never its target (-Recurse would follow it).
        [System.IO.Directory]::Delete($linkPath)
    } else {
        Remove-Item $linkPath -Force -Recurse
    }
}
New-Item -ItemType Junction -Path $linkPath -Target $src | Out-Null
if (-not (Test-Path $linkPath)) { throw 'junction creation failed' }

# ---------- 3. register ----------
Write-Host "[3/3] Registering in $patchFile" -ForegroundColor Cyan
$entryText = @'
- insert:
    - id: ui-aqua
      name: '@zhubai0528/dsh-client-ui-aqua-community-fix'
'@
if (-not (Test-Path $patchFile)) {
    Write-Utf8NoBom -Path $patchFile -Text ($entryText + "`n")
} else {
    $content = Get-Content $patchFile -Raw
    # Match the real list entry only, not the "duplicate loader entry id: ui-aqua" comment.
    if ($content -match '(?m)^\s*-\s+id:\s*ui-aqua\s*$') {
        Write-Host '  already registered, skip.' -ForegroundColor DarkGray
    } else {
        $base = ($content -replace '(?s)\[\s*\]\s*$', '').TrimEnd()
        if ($base -eq '') { $new = $entryText + "`n" } else { $new = $base + "`n`n" + $entryText + "`n" }
        Write-Utf8NoBom -Path $patchFile -Text $new
    }
}

Write-Host ''
Write-Host 'Done. Reload the Web UI (Aqua is on by default; open the "Glass theme" page in the left sidebar to adjust).' -ForegroundColor Green
Write-Host 'If the plugin does not appear after reload, restart the dsh web process.' -ForegroundColor Yellow
