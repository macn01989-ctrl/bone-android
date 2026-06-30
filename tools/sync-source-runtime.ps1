param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$distPublic = Join-Path $projectRoot "dist"
$runtimePublic = Join-Path $projectRoot "recovery\good-apk-public"
$runtimeAssets = Join-Path $runtimePublic "assets"

function Assert-InProject {
  param([string]$Path)
  $resolved = if (Test-Path $Path) {
    (Resolve-Path $Path).Path
  } else {
    $parent = Split-Path -Parent $Path
    (Resolve-Path $parent).Path
  }
  if (-not $resolved.StartsWith($projectRoot.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside project: $Path"
  }
}

function Assert-RequiredFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Missing required file: $Path"
  }
}

if (-not $SkipBuild) {
  Push-Location $projectRoot
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

Assert-RequiredFile (Join-Path $distPublic "index.html")
Assert-RequiredFile (Join-Path $runtimePublic "recommendations\album-catalog.json")

$recommendationCount = (Get-ChildItem (Join-Path $runtimePublic "recommendations") -Recurse -File | Measure-Object).Count
if ($recommendationCount -lt 1500) {
  throw "Runtime recommendations look incomplete. Expected at least 1500 files, got $recommendationCount"
}

$builtAssets = Get-ChildItem (Join-Path $distPublic "assets") -File |
  Where-Object { $_.Extension -in ".js", ".css", ".map" }
if ($builtAssets.Count -lt 2) {
  throw "Dist assets look incomplete. Expected JS and CSS bundle files."
}

$cssFiles = $builtAssets | Where-Object { $_.Extension -eq ".css" }
foreach ($css in $cssFiles) {
  $bytes = [System.IO.File]::ReadAllBytes($css.FullName)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    throw "Refusing to sync CSS with UTF-8 BOM: $($css.FullName)"
  }
}

Assert-InProject $runtimePublic
Assert-InProject $runtimeAssets
if (-not (Test-Path $runtimeAssets)) {
  New-Item -ItemType Directory -Path $runtimeAssets | Out-Null
}

$indexSource = Join-Path $distPublic "index.html"
$indexTarget = Join-Path $runtimePublic "index.html"
$indexText = [System.IO.File]::ReadAllText($indexSource)
$indexText = $indexText -replace "`r`n", "`n"
$indexText = $indexText -replace "`r", ""
[System.IO.File]::WriteAllText($indexTarget, $indexText, [System.Text.UTF8Encoding]::new($false))

Get-ChildItem $runtimeAssets -File |
  Where-Object {
    $_.Name -like "index-*.js" -or
    $_.Name -like "index-*.css" -or
    $_.Name -like "web-*.js" -or
    $_.Name -like "*.map"
  } |
  Remove-Item -Force

foreach ($asset in $builtAssets) {
  Copy-Item -LiteralPath $asset.FullName -Destination (Join-Path $runtimeAssets $asset.Name) -Force
}

Write-Host "Synced source build into runtime public assets."
Write-Host "Runtime public: $runtimePublic"
Write-Host "Copied bundle files: $($builtAssets.Count)"
Write-Host "Preserved recommendation files: $recommendationCount"
