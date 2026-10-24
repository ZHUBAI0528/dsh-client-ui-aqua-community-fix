# Aqua installer (Windows)
#
# DEFAULT: install from npm - the recommended path.
#   dsh plugin --profile <profile> add @zhubai0528/dsh-client-ui-aqua-community-fix
#
# One command (from any directory):
#   powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
#
# Options:
#   -Profile desktop     target profile (default: web)
#   -Version v2.0.1      pin a version (default: latest)
#   -DshHome <path>      DSH home (default: %USERPROFILE%\.dsh, or $env:DSH_HOME)
#   -Link                link the cloned source instead of installing from npm
#   -Source <url|path>   repo to clone; only meaningful with -Link
#
# ---------------------------------------------------------------------------
# -Link mode (development only)
# ---------------------------------------------------------------------------
# It downloads the repo (zip, or git clone as fallback), verifies lib/client.js
# against the published SHA256SUMS.txt, creates a directory JUNCTION in the
# profile's node_modules pointing at the clone, and registers ui-aqua in
# cordis.patch.yml.
#
# Do not use it for a normal install. A junction puts the app's file operations
# inside the source tree: uninstalling or rolling back the "installed package"
# deletes files in the real clone. It happened here - .git/HEAD, .git/config and
# .git/index were removed while the app was running.
#
# A junction also blocks any later npm install of the same package, from the
# Plugins page or `dsh plugin add`:
#   [ERR_PNPM_EPERM] [importPackage ...] rename ... EPERM: operation not permitted
# pnpm unpacks into <name>_tmp_<pid>_<n> and renames it over the target; NTFS
# refuses to replace a reparse point whose data is on another volume.
#
# To go back to npm: run this script without -Link. It removes a stale junction
# first, using [System.IO.Directory]::Delete (link only, never the target).
# Never remove one with a recursive delete - older tooling follows into it.

param(
    [string]$Source = 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix',
    [string]$Version = 'latest',
    [string]$DshHome = $env:DSH_HOME,
    [string]$Profile = 'web',
    [switch]$Link
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$plugin = '@zhubai0528/dsh-client-ui-aqua-community-fix'
$defaultSource = 'https://github.com/ZHUBAI0528/dsh-client-ui-aqua-community-fix'

# Windows PowerShell 5.1 writes a UTF-8 BOM for `Set-Content -Encoding UTF8`.
# A BOM at the head of a JSON manifest makes V8's JSON.parse throw
# ("Unexpected token '\uFEFF'"), which aborts the DSH host at startup - so all
# file writes below go through .NET with an explicit no-BOM encoder.
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Utf8NoBom {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Text)
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

# Locate the dsh CLI. PATH first, then the install directory of a running
# instance, then the two conventional layouts.
function Resolve-DshCli {
    $cmd = Get-Command dsh -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }

    $candidates = @()
    $proc = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and $proc.Path) {
        $candidates += (Join-Path (Split-Path $proc.Path -Parent) 'resources\runtime\cli\bin\dsh.cmd')
    }
    $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
    $candidates += (Join-Path $env:ProgramFiles 'DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd')
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    return $null
}

# Delete a junction/symlink at $Path, touching nothing behind it.
# Refuses anything that is not a reparse point, so a real npm install is never
# destroyed by accident. Returns $true when a link was removed.
function Remove-StaleLink {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $item = Get-Item $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return $false }
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }
    [System.IO.Directory]::Delete($Path)
    return $true
}

# Every place a previous link install could sit. `profiles\node_modules` is
# where older builds of this script wrote; the profile-scoped one is where the
# app's own local-directory install puts it.
function Get-LinkCandidates {
    param([Parameter(Mandatory)][string]$DshHome, [Parameter(Mandatory)][string]$Profile)
    $out = @()
    foreach ($name in @($plugin, '@zhubai0528/dsh-client-ui-aqua')) {
        $out += (Join-Path (Join-Path $DshHome 'profiles') "node_modules\$name")
        $out += (Join-Path (Join-Path (Join-Path $DshHome 'profiles') $Profile) "node_modules\$name")
    }
    return $out
}

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $DshHome)) { throw "DSH home not found: $DshHome (override with -DshHome)" }

$profilesRoot = Join-Path $DshHome 'profiles'
$profileRoot  = Join-Path $profilesRoot $Profile
if (-not (Test-Path $profileRoot)) {
    throw "profile not found: $profileRoot (create it in the app first, or pass -Profile)"
}

# ---------------------------------------------------------------------------
# npm mode (default)
# ---------------------------------------------------------------------------
if (-not $Link) {
    if ($Source -ne $defaultSource) {
        throw ("-Source is only used with -Link. Without -Link this script installs " +
               "$plugin from npm; drop -Source, or add -Link to build from a different repo.")
    }

    $spec = $plugin
    if ($Version -eq 'latest') {
        # pnpm's minimumReleaseAge skips releases published inside its window, so
        # a bare `add <pkg>` can land on an older version than npm's `latest` tag
        # (observed: 2.0.0 installed while 2.0.1 was the latest). Reading the tag
        # and pinning the exact version makes pnpm record an explicit exemption.
        $enc = $plugin -replace '/', '%2f'
        try {
            $info = Invoke-RestMethod -Uri "https://registry.npmjs.org/$enc/latest" `
                -Headers @{ 'User-Agent' = 'dsh-aqua-installer' } -TimeoutSec 15
            if ($info.version) {
                $spec = "$plugin@$($info.version)"
                Write-Host "  latest on npm: $($info.version)" -ForegroundColor Cyan
            }
        } catch {
            Write-Host '  (could not read the npm dist-tag - letting pnpm resolve latest)' -ForegroundColor DarkYellow
        }
    } elseif ($Version -match '^v?(\d+\.\d+\.\d+[0-9A-Za-z.\-+]*)$') {
        $spec = "$plugin@$($Matches[1])"
    } else {
        throw ("npm cannot install '$Version' - it is not a semantic version. " +
               "Pass -Version v2.0.1, or use -Link to install a branch or tag from git.")
    }

    Write-Host '[1/3] Locating the dsh CLI...' -ForegroundColor Cyan
    $dsh = Resolve-DshCli
    if (-not $dsh) {
        throw ("dsh CLI not found. Add the DeepSeek Harness bin directory to PATH, " +
               "or install from the desktop app: Plugins -> Add plugin -> $plugin")
    }
    Write-Host "  $dsh" -ForegroundColor DarkGray

    Write-Host '[2/3] Removing stale links...' -ForegroundColor Cyan
    $removed = 0
    foreach ($candidate in (Get-LinkCandidates -DshHome $DshHome -Profile $Profile)) {
        try {
            if (Remove-StaleLink -Path $candidate) {
                Write-Host "  removed link: $candidate" -ForegroundColor DarkGray
                $removed++
            }
        } catch {
            Write-Host "  could not remove link: $candidate" -ForegroundColor Yellow
            Write-Host "    $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host '    Close the app completely, then run this script again.' -ForegroundColor Yellow
            throw
        }
    }
    if ($removed -eq 0) { Write-Host '  none found.' -ForegroundColor DarkGray }

    Write-Host "[3/3] Installing $spec into profile '$Profile'..." -ForegroundColor Cyan
    if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) {
        Write-Host '  note: the app is running. If pnpm reports EPERM, close it and re-run.' -ForegroundColor DarkYellow
    }
    # The CLI resolves its own home from DSH_HOME, so a custom -DshHome has to be
    # exported for the child process or the install lands in the default one.
    $prevDshHome = $env:DSH_HOME
    $exit = 1
    try {
        $env:DSH_HOME = $DshHome
        & $dsh plugin --profile $Profile add $spec
        $exit = $LASTEXITCODE
    } finally {
        $env:DSH_HOME = $prevDshHome
    }
    if ($exit -ne 0) { throw "dsh plugin add failed (exit $exit)" }

    Write-Host ''
    Write-Host 'Done. Start (or reload) the app - Aqua is enabled; open the "Glass theme" page in the left sidebar to adjust it.' -ForegroundColor Green
    return
}

# ---------------------------------------------------------------------------
# -Link mode: clone + junction (development)
# ---------------------------------------------------------------------------
Write-Host '[1/4] Getting plugin source...' -ForegroundColor Cyan

$nodeModules = Join-Path $profileRoot 'node_modules'
$linkPath    = Join-Path $nodeModules $plugin
$patchFile   = Join-Path $profileRoot 'cordis.patch.yml'
# Persistent plugin location: %TEMP% can be wiped on reboot / disk cleanup,
# which would leave the junction dangling and break the next boot.
$pluginsDir  = Join-Path $DshHome 'plugins'
$cloneDir    = Join-Path $pluginsDir $plugin

# Verify the bundle that is about to be linked into the profile.
#
# This mode installs code from a GitHub snapshot, which is normally fetched as a
# plain archive with no signature. The repo publishes SHA256SUMS.txt (written by
# `npm run bundle`) covering lib/client.js - the one file the plugin actually
# executes - so the installer can compare the bytes it unpacked against the
# bytes the maintainer built.
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
        $p = $parts[1].TrimStart('*').Trim()
        if ($p -eq 'lib/client.js') { $expected = $parts[0].Trim().ToLower(); break }
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

# ---------- 1. source ----------
$isRemote = $Source -match '^(https?://|git@|ssh://|github:)'
$slug = $null
$ref  = $Version
if ($isRemote) {
    $repoUrl = $Source.TrimEnd('/').TrimEnd('.git')
    if ($repoUrl -match '^https?://github\.com/([^/]+/[^/]+)') { $slug = $Matches[1] }

    # Resolve the ref: 'latest' -> the newest release tag via the GitHub API;
    # a version-looking string (v1.2.3) is a tag; anything else is a branch.
    $isTag = $ref -match '^v\d+\.\d+'
    if ($ref -eq 'latest' -and $slug) {
        try {
            $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$slug/releases/latest" -Headers @{ 'User-Agent' = 'dsh-aqua-installer' } -TimeoutSec 15
            if ($latest.tag_name) {
                $ref = $latest.tag_name
                $isTag = $true
                Write-Host "  latest release: $ref" -ForegroundColor Cyan
            }
        } catch {
            Write-Host '  (latest-release lookup failed, falling back to the main branch)' -ForegroundColor Yellow
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
        # The plugin name is scoped (@zhubai0528/...), so create the parent level
        # too - Move-Item cannot create multi-level destination paths.
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

# ---------- 2. clear what is in the way ----------
Write-Host "[2/4] Linking -> $linkPath" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $nodeModules | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $linkPath -Parent) | Out-Null

# Any link install of this id, in either of the locations older builds used.
foreach ($candidate in (Get-LinkCandidates -DshHome $DshHome -Profile $Profile)) {
    if ($candidate -eq $linkPath) { continue }
    if (Remove-StaleLink -Path $candidate) {
        Write-Host "  removed stale link: $candidate" -ForegroundColor DarkGray
    }
}

if (Test-Path $linkPath) {
    $item = Get-Item $linkPath -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        # Delete the junction itself, never its target (a recursive delete follows it).
        [System.IO.Directory]::Delete($linkPath)
    } else {
        Write-Host '  replacing an npm install with a link (pnpm will no longer own this directory)' -ForegroundColor DarkYellow
        Remove-Item $linkPath -Force -Recurse
    }
}
New-Item -ItemType Junction -Path $linkPath -Target $src | Out-Null
if (-not (Test-Path $linkPath)) { throw 'junction creation failed' }

# ---------- 3. register ----------
Write-Host "[3/4] Registering in $patchFile" -ForegroundColor Cyan
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
Write-Host "[4/4] Done (link mode). Reload the app - Aqua is enabled; open the 'Glass theme' page to adjust it." -ForegroundColor Green
Write-Host 'Switch back to the npm package later by running this script without -Link.' -ForegroundColor Yellow
