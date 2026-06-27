param(
  [int]$StartAt = 0,
  [int]$Limit = 473,
  [string]$CheckpointPath = 'C:\Users\Lenovo\Desktop\杂活\rolling-stone-albums-web\work\claude-covers\complete_473_albums.zh.checkpoint.json',
  [int]$BatchSize = 1
)

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
& chcp.com 65001 | Out-Null
$sourcePath = 'C:\Users\Lenovo\Desktop\杂活\rolling-stone-albums-web\work\claude-covers\complete_473_albums.json'
$outputPath = 'C:\Users\Lenovo\Desktop\杂活\rolling-stone-albums-web\work\claude-covers\complete_473_albums.zh.json'
$checkpointPath = $CheckpointPath
$batchSize = $BatchSize

function Write-JsonUtf8($Path, $Value) {
  $json = $Value | ConvertTo-Json -Depth 16
  [System.IO.File]::WriteAllText($Path, "$json`n", [System.Text.UTF8Encoding]::new($false))
}

function Get-Prompt($Records) {
  $compact = @($Records | ForEach-Object {
    [ordered]@{ index=$_.index; input=$_.input; matchedAlbum=$_.matchedAlbum; sourceSummary=$_.sourceSummary; intro=$_.intro }
  })
  $data = $compact | ConvertTo-Json -Depth 12 -Compress
  return @"
你是一名严谨、克制的中文音乐编辑。请将以下滚石 500 大专辑资料修订成自然、完整、适合中文 App 展示的内容。

事实边界：只可依赖 input、matchedAlbum、sourceSummary、intro 中已有事实；不得编造制作人、年份、奖项、销量、影响、曲目或人物关系。艺人名、专辑名、曲名、厂牌名等专有名称必须保留原文，不得翻译或音译；除专有名词外，所有说明文字必须是自然中文，不能留下英文句子、英文音乐术语或半句中英混杂。

风格规则：genres、styles、keywords 必须全部使用规范中文音乐风格词或中文关键词。曲目名可保留原名。

文案规则：introTitle 为克制自然的中文标题；shortIntro 为 1-2 句中文；fullIntro 为 2-3 个自然段，完整通顺且不煽情。listeningMoment、whyKeep、sourceSummary 的所有说明字段也必须中文；信息不足则留空，绝不补造。

输出规则：先生成严格 JSON 数组，再把整个 JSON 用 UTF-8 Base64 编码。最终只输出这一串 Base64 字符，不要 Markdown、解释、代码块或任何其他字符。数组长度必须和输入一致；每项只含 index、matchedAlbum、sourceSummary、intro。所有文本字段里禁止使用任何引号字符；专辑名、艺人名和曲名直接写，不要加引号。matchedAlbum 的 releaseDate、releaseYear、label、trackCount、notableTracks、appleMusicUrl、coverUrl 必须保持原值，只翻译 genres 与 styles。

待修订数据：
$data
"@
}

$source = @()
$sourceData = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($item in $sourceData) { $source += $item }
$checkpoint = @{}
if (Test-Path -LiteralPath $checkpointPath) {
  $saved = Get-Content -LiteralPath $checkpointPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($property in $saved.PSObject.Properties) { $checkpoint[$property.Name] = $property.Value }
}

$stopAt = [Math]::Min($source.Count, $StartAt + $Limit)
for ($start = $StartAt; $start -lt $stopAt; $start += $batchSize) {
  $end = [Math]::Min($start + $batchSize - 1, $stopAt - 1)
  $batch = @()
  for ($index = $start; $index -le $end; $index++) {
    if (-not $checkpoint.ContainsKey([string]$index)) {
      $clone = $source[$index] | Select-Object *
      $clone | Add-Member -NotePropertyName index -NotePropertyValue $index
      $batch += $clone
    }
  }
  if ($batch.Count -eq 0) { continue }

  Write-Host "请求 $($start + 1)-$($end + 1)"
  $promptFile = Join-Path $env:TEMP ("bone-rolling-stone-" + [guid]::NewGuid().ToString() + '.md')
  [System.IO.File]::WriteAllText($promptFile, (Get-Prompt $batch), [System.Text.UTF8Encoding]::new($true))
  try {
    $raw = @(& claude.exe -p 'Return the required JSON array now.' --system-prompt-file $promptFile --output-format json --max-turns 1 --tools '' --permission-mode plan) -join [Environment]::NewLine
  } finally {
    Remove-Item -LiteralPath $promptFile -Force -ErrorAction SilentlyContinue
  }
  $envelope = $raw | ConvertFrom-Json
  if ($envelope.subtype -ne 'success' -or -not $envelope.result) { throw "Claude 调用失败：$($envelope | ConvertTo-Json -Compress)" }
  $encoded = $envelope.result.Trim() -replace '\s', ''
  if ($encoded.StartsWith('```')) { $encoded = $encoded -replace '^```(?:base64)?\s*', '' -replace '\s*```$', '' }
  try {
    $text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded))
  } catch {
    throw "模型未返回有效 Base64 JSON：$($envelope.result)"
  }
  $revised = @()
  $parsed = $text | ConvertFrom-Json
  foreach ($entry in $parsed) { $revised += $entry }
  if ($revised.Count -ne $batch.Count) { throw "模型返回条数错误：期望 $($batch.Count)，实际 $($revised.Count)" }
  foreach ($item in $revised) {
    if ($null -eq $item.index -or -not $item.matchedAlbum -or -not $item.sourceSummary -or -not $item.intro) { throw '模型返回字段不完整' }
    $checkpoint[[string]$item.index] = $item
  }
  Write-JsonUtf8 $checkpointPath $checkpoint
  Write-Host "完成 $($checkpoint.Count)/$($source.Count)"
}

if ($checkpoint.Count -lt $source.Count) {
  Write-Host "检查点：$($checkpoint.Count)/$($source.Count)，本次分段处理结束。"
  exit 0
}

$normalized = @()
for ($index = 0; $index -lt $source.Count; $index++) {
  $original = $source[$index]
  $revised = $checkpoint[[string]$index]
  if (-not $revised) { throw "缺少第 $($index + 1) 条结果" }
  $original.matchedAlbum = $revised.matchedAlbum
  $original.sourceSummary = $revised.sourceSummary
  $original.intro = $revised.intro
  $normalized += $original
}
Write-JsonUtf8 $outputPath $normalized
Write-Host "已写入 $outputPath（$($normalized.Count) 条）"
