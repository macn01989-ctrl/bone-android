$ErrorActionPreference = 'Stop'

$work = Join-Path (Join-Path 'C:\Users\Lenovo\Desktop' (([char]0x6742) + ([char]0x6D3B))) 'rolling-stone-albums-web\work\claude-covers'
$sourcePath = Join-Path $work 'complete_473_albums.json'
$outputPath = Join-Path $work 'remaining_125_albums_for_revision.json'
$checkpointFiles = @(
  'complete_473_albums.zh.checkpoint.json',
  'complete_473_albums.zh.w1.checkpoint.json',
  'complete_473_albums.zh.w2.checkpoint.json',
  'complete_473_albums.zh.w3.checkpoint.json',
  'complete_473_albums.zh.w4.checkpoint.json',
  'complete_473_albums.zh.w5.checkpoint.json'
)

$completed = @{}
foreach ($file in $checkpointFiles) {
  $path = Join-Path $work $file
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $checkpoint = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($property in $checkpoint.PSObject.Properties) { $completed[[int]$property.Name] = $true }
}

$sourceData = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
$source = @()
foreach ($entry in $sourceData) { $source += $entry }
$remaining = @()
for ($index = 0; $index -lt $source.Count; $index++) {
  if ($completed.ContainsKey($index)) { continue }
  $item = $source[$index]
  $remaining += [ordered]@{
    index = $index
    input = $item.input
    matchedAlbum = $item.matchedAlbum
    sourceSummary = $item.sourceSummary
    intro = $item.intro
  }
}

[System.IO.File]::WriteAllText($outputPath, (($remaining | ConvertTo-Json -Depth 16) + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
Write-Output "remaining=$($remaining.Count)"
Write-Output $outputPath
