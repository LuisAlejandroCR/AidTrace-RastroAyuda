param(
  [string]$BaseUrl = "https://aidtrace-rastroayuda.vercel.app",
  [string]$Origin = "https://aidtrace-rastroayuda.vercel.app",
  [switch]$SkipRemote
)

$ErrorActionPreference = "Stop"

function Step($Message) {
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Assert-Ok($Condition, $Message) {
  if (-not $Condition) {
    throw $Message
  }
  Write-Host "OK: $Message" -ForegroundColor Green
}

function Invoke-CurlProbe($Arguments) {
  $output = & curl.exe @Arguments 2>$null
  $text = ($output -join "`n")
  $status = 0
  $matches = [regex]::Matches($text, "HTTP/\S+\s+(\d{3})")
  if ($matches.Count -gt 0) {
    $status = [int]$matches[$matches.Count - 1].Groups[1].Value
  }
  return @{
    StatusCode = $status
    Text = $text
  }
}

Step "Local parser and syntax checks"
npm.cmd run test
npm.cmd run check

if ($SkipRemote) {
  Write-Host ""
  Write-Host "Skipped remote endpoint checks." -ForegroundColor Yellow
  exit 0
}

$BaseUrl = $BaseUrl.TrimEnd("/")

Step "Timeline direct JSON"
$timeline = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/timeline?limit=30"
Assert-Ok ($timeline.ok -eq $true) "timeline endpoint returns ok=true"
Assert-Ok ($timeline.contractAddress -match "^0x[0-9a-fA-F]{40}$") "timeline includes a contract address"

if ($timeline.pagination.nextCursor -ne $null) {
  Step "Timeline cursor page"
  $nextCursor = [int]$timeline.pagination.nextCursor
  $next = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/timeline?limit=30&cursor=$nextCursor"
  Assert-Ok ($next.ok -eq $true) "timeline cursor endpoint returns ok=true"
}

Step "Timeline CORS allowlist"
$cors = Invoke-CurlProbe @("-s", "-i", "-X", "OPTIONS", "$BaseUrl/api/timeline", "-H", "Origin: $Origin")
Assert-Ok ($cors.StatusCode -eq 204) "allowed Origin receives OPTIONS 204"
Assert-Ok ($cors.Text -match "Access-Control-Allow-Origin:\s*$([regex]::Escape($Origin))") "allowed Origin is echoed"

Step "Timeline CORS rejection"
$badCors = Invoke-CurlProbe @("-s", "-i", "-X", "OPTIONS", "$BaseUrl/api/timeline", "-H", "Origin: https://evil.example")
Assert-Ok ($badCors.StatusCode -eq 403) "unknown Origin is rejected with 403"

Step "Browser relay bad origin rejection"
$badRelayBody = @{
  schema = "aidtrace.relay.v1"
  pending = @()
} | ConvertTo-Json -Depth 5

$badRelay = Invoke-CurlProbe @(
  "-s", "-i",
  "-X", "POST",
  "$BaseUrl/api/zavu",
  "-H", "Origin: https://evil.example",
  "-H", "Content-Type: application/json",
  "--data", $badRelayBody
)
if ($badRelay.StatusCode -ne 403) {
  Write-Host "Bad-origin relay actual status: $($badRelay.StatusCode)" -ForegroundColor Yellow
  Write-Host ($badRelay.Text.Substring(0, [Math]::Min(700, $badRelay.Text.Length))) -ForegroundColor DarkYellow
}
Assert-Ok ($badRelay.StatusCode -eq 403) "unknown Origin browser relay is rejected with 403"

Write-Host ""
Write-Host "Final demo smoke checks passed." -ForegroundColor Green
