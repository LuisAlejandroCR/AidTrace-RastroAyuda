# scripts/invent-smoke-check.ps1
#
# Smoke-tests the /api/invent endpoint on a live Vercel deployment.
# Run after deploying the invent.mjs adapter:
#
#   .\scripts\invent-smoke-check.ps1 `
#     -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
#     -Token   "your-invent-webhook-token"
#
# What it checks:
#   1. Missing token → 401
#   2. Wrong token   → 401
#   3. Missing body  → 400
#   4. Non-command message → 200 + reason: not_a_command
#   5. Valid WhatsApp custody command → 200 + ok: true
#   6. Valid SMS custody command      → 200 + ok: true

param(
  [string]$BaseUrl = "https://aidtrace-rastroayuda.vercel.app",
  [string]$Token   = $env:AIDTRACE_INVENT_WEBHOOK_TOKEN
)

$ErrorActionPreference = "Stop"
$endpoint = "$BaseUrl/api/invent"
$pass = 0
$fail = 0

function Check($label, $response, $expectedStatus, $bodyCheck) {
  $ok = $true
  if ($response.StatusCode -ne $expectedStatus) {
    Write-Host "FAIL [$label] expected HTTP $expectedStatus got $($response.StatusCode)" -ForegroundColor Red
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

function Post($headers, $body) {
  try {
    return Invoke-WebRequest -Method POST -Uri $endpoint `
      -Headers $headers `
      -Body ($body | ConvertTo-Json) `
      -ContentType "application/json" `
      -ErrorAction SilentlyContinue
  } catch {
    return $_.Exception.Response
  }
}

Write-Host "`n=== Invent channel smoke-check ===" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint"
Write-Host "Token set: $(-not [string]::IsNullOrEmpty($Token))`n"

# Test 1: No auth header → 401
$r = Post @{} @{ contact_id="c1"; message="CELO1 depositar 10 cajas"; channel="whatsapp" }
Check "No auth token -> 401" $r 401 $null

# Test 2: Wrong token → 401
$r = Post @{ "X-AidTrace-Invent-Token" = "wrong-token" } @{ contact_id="c1"; message="CELO1 depositar 10 cajas"; channel="whatsapp" }
Check "Wrong token -> 401" $r 401 $null

# Test 3: Missing contact_id → 400
$r = Post @{ "X-AidTrace-Invent-Token" = $Token } @{ message="CELO1 depositar 10 cajas" }
Check "Missing contact_id -> 400" $r 400 $null

# Test 4: Non-command message → 200, reason = not_a_command
$r = Post @{ "X-AidTrace-Invent-Token" = $Token } @{
  contact_id   = "contact-test-001"
  contact_name = "Test User"
  channel      = "whatsapp"
  phone        = "+584121234567"
  message      = "Hola, quiero saber el estado del envío"
}
Check "Non-command -> not_a_command" $r 200 { param($b) $b.reason -eq "not_a_command" }

# Test 5: Valid WhatsApp custody command → 200, ok = true
$r = Post @{ "X-AidTrace-Invent-Token" = $Token } @{
  contact_id   = "contact-smoke-wa-001"
  contact_name = "Campo Test"
  channel      = "whatsapp"
  phone        = "+584121234567"
  message      = "CELO1 depositar 25 cajas de ibuprofeno refugio norte"
}
Check "WhatsApp custody command -> ok" $r 200 { param($b) $b.ok -eq $true }

# Test 6: Valid SMS custody command → 200, ok = true
$r = Post @{ "X-AidTrace-Invent-Token" = $Token } @{
  contact_id   = "contact-smoke-sms-001"
  contact_name = "Campo Test SMS"
  channel      = "sms"
  phone        = "+584121234568"
  message      = "CELO1 entregar 10 kits agua"
}
Check "SMS custody command -> ok" $r 200 { param($b) $b.ok -eq $true }

# Summary
Write-Host "`n=== Results ===" -ForegroundColor Cyan
Write-Host "PASS: $pass  FAIL: $fail"
if ($fail -gt 0) { exit 1 } else { exit 0 }
