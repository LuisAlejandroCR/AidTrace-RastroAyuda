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
$headers = @{ "Origin" = $Origin }
$cors = Invoke-WebRequest -Method OPTIONS -Uri "$BaseUrl/api/timeline" -Headers $headers
Assert-Ok ($cors.StatusCode -eq 204) "allowed Origin receives OPTIONS 204"
Assert-Ok ($cors.Headers["Access-Control-Allow-Origin"] -eq $Origin) "allowed Origin is echoed"

Step "Timeline CORS rejection"
try {
  Invoke-WebRequest -Method OPTIONS -Uri "$BaseUrl/api/timeline" -Headers @{ "Origin" = "https://evil.example" } | Out-Null
  throw "unknown Origin was not rejected"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Assert-Ok ($status -eq 403) "unknown Origin is rejected with 403"
}

Step "Browser relay bad origin rejection"
$badRelayBody = @{
  schema = "aidtrace.relay.v1"
  pending = @()
} | ConvertTo-Json -Depth 5

try {
  Invoke-WebRequest `
    -Method POST `
    -Uri "$BaseUrl/api/zavu" `
    -Headers @{ "Origin" = "https://evil.example"; "Content-Type" = "application/json" } `
    -Body $badRelayBody | Out-Null
  throw "unknown Origin browser relay was not rejected"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Assert-Ok ($status -eq 403) "unknown Origin browser relay is rejected with 403"
}

Write-Host ""
Write-Host "Final demo smoke checks passed." -ForegroundColor Green
