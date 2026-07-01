# scripts/center-webhook-smoke-check.ps1
#
# Smoke-tests /api/center-webhook and /api/center-inventory on a live Vercel deployment.
# Run after deploying and setting the three center env vars in Vercel:
#   AIDTRACE_CENTER_WEBHOOK_URL    = https://<app>/api/center-webhook
#   AIDTRACE_CENTER_WEBHOOK_SECRET = <same secret used here>
#   AIDTRACE_CENTER_NOTIFY_CHAT    = <Zavu chat ID>
#
#   .\scripts\center-webhook-smoke-check.ps1 `
#     -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
#     -Secret  $env:AIDTRACE_CENTER_WEBHOOK_SECRET
#
# What it checks:
#   1. No auth header          -> 401
#   2. Wrong secret            -> 401
#   3. Non-delivery event      -> 200, skipped: true
#   4. Valid center.delivery   -> 200, ok: true
#   5. GET center-inventory    -> 200, ok: true (verifies Supabase row landed)

param(
  [string]$BaseUrl = "https://aidtrace-rastroayuda.vercel.app",
  [string]$Secret  = $env:AIDTRACE_CENTER_WEBHOOK_SECRET
)

$ErrorActionPreference = "Stop"
$webhookEndpoint   = "$BaseUrl/api/center-webhook"
$inventoryEndpoint = "$BaseUrl/api/center-inventory"
$pass = 0
$fail = 0
$testCenterCode = "CENTRO-SMOKE-$(Get-Random -Maximum 9999)"

function Check($label, $response, $expectedStatus, $bodyCheck) {
  $ok = $true
  if ($null -eq $response -or $null -eq $response.StatusCode) {
    Write-Host "FAIL [$label] no response received" -ForegroundColor Red
    $script:fail++
    return
  }
  if ([int]$response.StatusCode -ne $expectedStatus) {
    Write-Host "FAIL [$label] expected HTTP $expectedStatus got $([int]$response.StatusCode)" -ForegroundColor Red
    $ok = $false
  } else {
    $body = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($bodyCheck -and -not ($bodyCheck.Invoke($body))) {
      Write-Host "FAIL [$label] body check failed: $($response.Content)" -ForegroundColor Red
      $ok = $false
    } else {
      Write-Host "PASS [$label]" -ForegroundColor Green
    }
  }
  if ($ok) { $script:pass++ } else { $script:fail++ }
}

function Post($headers, $body, $endpoint) {
  try {
    return Invoke-WebRequest -Method POST -Uri $endpoint `
      -Headers $headers `
      -Body ($body | ConvertTo-Json -Depth 5) `
      -ContentType "application/json" `
      -UseBasicParsing `
      -ErrorAction Stop
  } catch {
    return $_.Exception.Response
  }
}

function Get($url) {
  try {
    return Invoke-WebRequest -Method GET -Uri $url -UseBasicParsing -ErrorAction Stop
  } catch {
    return $_.Exception.Response
  }
}

Write-Host ""
Write-Host "=== Center webhook smoke-check ===" -ForegroundColor Cyan
Write-Host "Endpoint : $webhookEndpoint"
Write-Host "Inventory: $inventoryEndpoint"
Write-Host "Secret set: $(-not [string]::IsNullOrEmpty($Secret))"
Write-Host "Test center code: $testCenterCode"
Write-Host ""

if ([string]::IsNullOrEmpty($Secret)) {
  Write-Host "WARNING: No secret provided. Tests 1 and 2 will fail if AIDTRACE_CENTER_WEBHOOK_SECRET is set on server." -ForegroundColor Yellow
  Write-Host ""
}

# Test 1: No auth -> 401
$r = Post @{} @{ event = "center.delivery"; centerCode = $testCenterCode; batchId = "BATCH-SMOKE-001"; actionType = "DELIVERED" } $webhookEndpoint
Check "No auth header -> 401" $r 401 $null

# Test 2: Wrong secret -> 401
$r = Post @{ Authorization = "Bearer wrong-secret-xyz" } @{ event = "center.delivery"; centerCode = $testCenterCode; batchId = "BATCH-SMOKE-001"; actionType = "DELIVERED" } $webhookEndpoint
Check "Wrong secret -> 401" $r 401 $null

# Test 3: Non-delivery event -> 200, skipped = true
$r = Post @{ Authorization = "Bearer $Secret" } @{ event = "other.event"; centerCode = $testCenterCode } $webhookEndpoint
Check "Non-delivery event -> 200 skipped" $r 200 { param($b) $b.skipped -eq $true }

# Test 4: Valid center.delivery -> 200, ok = true
$batchId = "BATCH-SMOKE-$(Get-Random -Maximum 9999)"
$r = Post @{ Authorization = "Bearer $Secret" } @{
  event      = "center.delivery"
  centerCode = $testCenterCode
  batchId    = $batchId
  actionType = "DELIVERED"
  details    = "50 cajas agua purificada smoke test"
  txHash     = "0x" + ("0123456789abcdef" * 4).Substring(0, 64)
} $webhookEndpoint
Check "Valid center.delivery -> 200 ok" $r 200 { param($b) $b.ok -eq $true }

# Test 5: GET /api/center-inventory -> returns the center row
# Brief pause so the Supabase write from test 4 is visible to the read path.
Start-Sleep -Seconds 2
$r = Get "${inventoryEndpoint}?center=${testCenterCode}"
if ($null -ne $r -and [int]$r.StatusCode -eq 503) {
  Write-Host "SKIP [center-inventory] Supabase not configured (503)" -ForegroundColor Yellow
} else {
  Check "center-inventory GET -> 200 ok" $r 200 { param($b) $b.ok -eq $true -and $b.count -ge 1 }
}

Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "PASS: $pass  FAIL: $fail"
if ($fail -gt 0) { exit 1 } else { exit 0 }
