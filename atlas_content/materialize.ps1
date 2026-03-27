$files = @(
  'atlas_content/bootstrap_content.py',
  'atlas_content/bootstrap_content_append.py',
  'atlas_content/bootstrap_content_append2.py',
  'atlas_content/bootstrap_content_append3.py',
  'atlas_content/bootstrap_content_append4.py'
)
$patterns = @(
  "w\('([^']+)',\s*'''([\s\S]*?)'''\)",
  'w\(''([^'']+)'',\s*"([\s\S]*?)"\)',
  "w\('([^']+)',\s*''\)"
)
foreach ($file in $files) {
  $text = Get-Content $file -Raw
  foreach ($pattern in $patterns) {
    $matches = [regex]::Matches($text, $pattern)
    foreach ($m in $matches) {
      $path = $m.Groups[1].Value
      $content = if ($m.Groups.Count -gt 2) { $m.Groups[2].Value } else { '' }
      $full = Join-Path 'atlas_content' $path
      $dir = Split-Path $full -Parent
      if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
      Set-Content -Path $full -Value $content -NoNewline
    }
  }
}
