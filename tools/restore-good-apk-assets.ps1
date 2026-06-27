param(
  [switch]$SkipDist
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$goldenPublic = Join-Path $projectRoot "recovery\good-apk-public"
$androidPublic = Join-Path $projectRoot "android\app\src\main\assets\public"
$distPublic = Join-Path $projectRoot "dist"

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

if (-not (Test-Path $goldenPublic)) {
  throw "Missing golden public assets: $goldenPublic"
}

$recommendationCount = (Get-ChildItem (Join-Path $goldenPublic "recommendations") -Recurse -File | Measure-Object).Count
if ($recommendationCount -lt 1500) {
  throw "Golden assets look incomplete. Expected at least 1500 recommendation files, got $recommendationCount"
}

Assert-InProject $androidPublic
if (Test-Path $androidPublic) {
  Remove-Item -LiteralPath $androidPublic -Recurse -Force
}
Copy-Item -LiteralPath $goldenPublic -Destination $androidPublic -Recurse -Force

if (-not $SkipDist) {
  Assert-InProject $distPublic
  if (Test-Path $distPublic) {
    Remove-Item -LiteralPath $distPublic -Recurse -Force
  }
  Copy-Item -LiteralPath $goldenPublic -Destination $distPublic -Recurse -Force
}

Write-Host "Restored good APK assets."
Write-Host "Android public: $androidPublic"
if (-not $SkipDist) {
  Write-Host "Dist public: $distPublic"
}
Write-Host "Recommendation files: $recommendationCount"
