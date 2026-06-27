$ErrorActionPreference = 'Stop'

$work = Join-Path (Join-Path 'C:\Users\Lenovo\Desktop' (([char]0x6742) + ([char]0x6D3B))) 'rolling-stone-albums-web\work\claude-covers'
$sourcePath = Join-Path $work 'complete_473_albums.json'
$outputPath = Join-Path $work 'complete_473_albums.zh.json'
$externalPath = 'C:\Users\Lenovo\WorkBuddy\2026-06-23-16-31-37\remaining_125_revised.json'
$checkpointFiles = @(
  'complete_473_albums.zh.checkpoint.json',
  'complete_473_albums.zh.w1.checkpoint.json',
  'complete_473_albums.zh.w2.checkpoint.json',
  'complete_473_albums.zh.w3.checkpoint.json',
  'complete_473_albums.zh.w4.checkpoint.json',
  'complete_473_albums.zh.w5.checkpoint.json'
)

$sourceData = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
$source = @()
foreach ($entry in $sourceData) { $source += $entry }

$revisions = @{}
foreach ($file in $checkpointFiles) {
  $path = Join-Path $work $file
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $checkpoint = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($property in $checkpoint.PSObject.Properties) {
    $revisions[[int]$property.Name] = $property.Value
  }
}

$external = Get-Content -LiteralPath $externalPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $external) {
  if ($null -eq $entry.index -or -not $entry.matchedAlbum -or -not $entry.sourceSummary -or -not $entry.intro) {
    throw 'External revision entry is missing a required field.'
  }
  $revisions[[int]$entry.index] = $entry
}

if ($revisions.Count -ne $source.Count) {
  throw "Revision coverage is incomplete: $($revisions.Count)/$($source.Count)."
}

$merged = @()
for ($index = 0; $index -lt $source.Count; $index++) {
  if (-not $revisions.ContainsKey($index)) { throw "Missing revision for index=$index." }
  $original = $source[$index] | Select-Object *
  $revised = $revisions[$index]
  $original.matchedAlbum = $revised.matchedAlbum
  $original.sourceSummary = $revised.sourceSummary
  $original.intro = $revised.intro
  $merged += $original
}

[System.IO.File]::WriteAllText(
  $outputPath,
  (($merged | ConvertTo-Json -Depth 16) + [Environment]::NewLine),
  [System.Text.UTF8Encoding]::new($false)
)
Write-Output "merged=$($merged.Count)"
Write-Output $outputPath
