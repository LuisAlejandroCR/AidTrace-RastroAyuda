# scripts/iteration2-smoke-check.ps1
#
# Smoke-tests the four iteration-2 endpoints on a live Vercel deployment.
# Requires AIDTRACE_QUEUE_WORKER_TOKEN to be set in your env or passed as -Token.
#
#   .\scripts\iteration2-smoke-check.ps1 `
#     -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
#     -Token   $env:AIDTRACE_QUEUE_WORKER_TOKEN
#
# Tests:
#   1. GET  /api/queue-status              -> 200, ok:true, has counts object
#   2. GET  /api/center-inventory?all=true -> 200, ok:true, centers array present
#   3. GET  /api/export?center=CENTRO-TEST -> 200, Content-Type text/csv
#   4. POST /api/retry-queue  (no auth)    -> 401
#   5. POST /api/retry-queue  (bad token)  -> 401
#   6. POST /api/retry-queue  (bad UUID)   -> 400
#   7. POST /api/retry-queue  (valid UUID, no row) -> 200, ok:false

param(
  [string]$BaseUrl = "https://aidtrace-rastroayuda.vercel.app",
  [string]$Token   = $env:AIDTRACE_QUEUE_WORKER_TOKEN
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Check($label, $response, $expectedStatus, $bodyCheck, $headerCheck) {
  $ok = $true
  if ($null -eq $response -or $null -eq $response.StatusCode) {
    Write-Host "FAIL [$label] no response received" -ForegroundColor Red
    $script:fail++
    return
  }
  if ($response.StatusCode -ne $expectedStatus) {
    Write-Host "FAIL [$label] expected HTTP $expectedStatus got $($response.StatusCode)" -ForegroundColor Red
    $ok = $false
  } else {
    if ($headerCheck -and -not ($headerCheck.Invoke($response.Headers))) {
      Write-Host "FAIL [$label] header check failed. Headers: $($response.Headers | ConvertTo-Json -Compress)" -ForegroundColor Red
      $ok = $false
    }
    if ($bodyCheck) {
      $body = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
      if (-not ($bodyCheck.Invoke($body))) {
        Write-Host "FAIL [$label] body check failed: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))" -ForegroundColor Red
        $ok = $false
      }
    }
    if ($ok) { Write-Host "PASS [$label]" -ForegroundColor Green }
  }
  if ($ok) { $script:pass++ } else { $script:fail++ }
}

function HttpGet($url, $headers = @{}) {
  try {
    return Invoke-WebRequest -Method GET -Uri $url -Headers $headers -UseBasicParsing -ErrorAction Stop
  } catch {
    return $_.Exception.Response
  }
}

function HttpPost($url, $headers, $body) {
  try {
    return Invoke-WebRequest -Method POST -Uri $url `
      -Headers $headers `
      -Body ($body | ConvertTo-Json -Depth 5) `
      -ContentType "application/json" `
      -UseBasicParsing `
      -ErrorAction Stop
  } catch {
    return $_.Exception.Response
  }
}

function ContentTypeContains($headers, $value) {
  $ct = $headers["Content-Type"]
  if ($ct -is [System.Collections.IEnumerable] -and $ct -isnot [string]) {
    return ($ct | Where-Object { $_ -like "*$value*" }) -ne $null
  }
  return [string]$ct -like "*$value*"
}

Write-Host ""
Write-Host "=== Iteration 2 smoke-check ===" -ForegroundColor Cyan
Write-Host "Base URL   : $BaseUrl"
Write-Host "Token set  : $(-not [string]::IsNullOrEmpty($Token))"
Write-Host ""

if ([string]::IsNullOrEmpty($Token)) {
  Write-Host "WARNING: -Token not provided. Tests 4-7 will test auth rejection only." -ForegroundColor Yellow
  Write-Host ""
}

# -----------------------------------------------------------------------
# 1. GET /api/queue-status -> 200, ok:true, counts object present
# -----------------------------------------------------------------------
$r = HttpGet "$BaseUrl/api/queue-status"
if ($r.StatusCode -eq 503) {
  Write-Host "SKIP [queue-status] Supabase not configured (503)" -ForegroundColor Yellow
} else {
  Check "queue-status -> 200 ok with counts" $r 200 `
    { param($b) $b.ok -eq $true -and $null -ne $b.counts } `
    $null
}

# -----------------------------------------------------------------------
# 2. GET /api/center-inventory?all=true -> 200, ok:true, centers array
# -----------------------------------------------------------------------
$r = HttpGet "$BaseUrl/api/center-inventory?all=true"
if ($r.StatusCode -eq 503) {
  Write-Host "SKIP [center-inventory all] Supabase not configured (503)" -ForegroundColor Yellow
} else {
  Check "center-inventory?all=true -> 200 ok with centers" $r 200 `
    { param($b) $b.ok -eq $true -and $null -ne $b.centers } `
    $null
}

# -----------------------------------------------------------------------
# 3. GET /api/export?center=CENTRO-SMOKE-TEST -> 200, text/csv
# -----------------------------------------------------------------------
$r = HttpGet "$BaseUrl/api/export?center=CENTRO-SMOKE-TEST"
if ($r.StatusCode -eq 503) {
  Write-Host "SKIP [export] Supabase not configured (503)" -ForegroundColor Yellow
} else {
  Check "export?center=CENTRO-SMOKE-TEST -> 200 text/csv" $r 200 `
    $null `
    { param($h) ContentTypeContains $h "text/csv" }
}

# -----------------------------------------------------------------------
# 4. POST /api/retry-queue — no auth -> 401
# -----------------------------------------------------------------------
$r = HttpPost "$BaseUrl/api/retry-queue" @{} @{ id = "00000000-0000-0000-0000-000000000001" }
Check "retry-queue no auth -> 401" $r 401 $null $null

# -----------------------------------------------------------------------
# 5. POST /api/retry-queue — wrong token -> 401
# -----------------------------------------------------------------------
$r = HttpPost "$BaseUrl/api/retry-queue" @{ Authorization = "Bearer not-the-right-token" } @{ id = "00000000-0000-0000-0000-000000000001" }
Check "retry-queue wrong token -> 401" $r 401 $null $null

# -----------------------------------------------------------------------
# 6. POST /api/retry-queue — bad UUID format -> 400
# -----------------------------------------------------------------------
if (-not [string]::IsNullOrEmpty($Token)) {
  $r = HttpPost "$BaseUrl/api/retry-queue" @{ Authorization = "Bearer $Token" } @{ id = "not-a-uuid" }
  Check "retry-queue bad UUID -> 400" $r 400 $null $null
} else {
  Write-Host "SKIP [retry-queue bad UUID] no token provided" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------
# 7. POST /api/retry-queue — valid UUID format, non-existent row -> 200 ok:false
# -----------------------------------------------------------------------
if (-not [string]::IsNullOrEmpty($Token)) {
  $r = HttpPost "$BaseUrl/api/retry-queue" @{ Authorization = "Bearer $Token" } @{ id = "00000000-0000-4000-8000-000000000001" }
  if ($r.StatusCode -eq 503) {
    Write-Host "SKIP [retry-queue valid UUID] Supabase not configured (503)" -ForegroundColor Yellow
  } else {
    Check "retry-queue non-existent UUID -> 200 ok:false" $r 200 `
      { param($b) $b.ok -eq $false } `
      $null
  }
} else {
  Write-Host "SKIP [retry-queue valid UUID] no token provided" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "PASS: $pass  FAIL: $fail"
if ($fail -gt 0) { exit 1 } else { exit 0 }
