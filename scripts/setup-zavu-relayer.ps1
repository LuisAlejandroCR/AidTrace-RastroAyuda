param(
  [Parameter(Mandatory = $true)]
  [string] $SenderId,

  [string] $FunctionName = "aidtrace-relayer",

  [string] $RelayerPrivateKeyEnv = "RASTROAYUDA_RELAYER_PRIVATE_KEY",

  [string] $ContractAddress = "0xaf5c40e82ac9255479a1f447e81992b71c4f4934",

  [string] $CeloRpcUrl = "https://forno.celo.org",

  [string] $PrimaryChannel = "telegram",

  [string] $FallbackChannel = "sms",

  [string] $EnableSmsFallback = "false",

  [string] $AppBaseUrl = "https://your-aidtrace-url.example"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $repoRoot "zavu\aidtrace-relayer"
$workspaceRoot = Join-Path $repoRoot "work\zavu"
$functionDir = Join-Path $workspaceRoot $FunctionName
$relayerPrivateKey = [Environment]::GetEnvironmentVariable($RelayerPrivateKeyEnv)

if (-not (Get-Command zavu -ErrorAction SilentlyContinue)) {
  throw "zavu CLI was not found. Install/login first, then rerun: zavu login"
}

if (-not $relayerPrivateKey) {
  throw "Set `$env:$RelayerPrivateKeyEnv before running this script."
}

if (-not (Test-Path -LiteralPath $sourceDir)) {
  throw "Starter source not found: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $workspaceRoot | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $functionDir ".zavu\config.json"))) {
  Push-Location $workspaceRoot
  try {
    zavu fn init $FunctionName --template blank
  } finally {
    Pop-Location
  }
}

Copy-Item -LiteralPath (Join-Path $sourceDir "index.ts") -Destination (Join-Path $functionDir "index.ts") -Force
Copy-Item -LiteralPath (Join-Path $sourceDir "package.json") -Destination (Join-Path $functionDir "package.json") -Force

Push-Location $functionDir
try {
  zavu fn secrets set SENDER_ID $SenderId
  zavu fn secrets set PRIMARY_CHANNEL $PrimaryChannel
  zavu fn secrets set FALLBACK_CHANNEL $FallbackChannel
  zavu fn secrets set ENABLE_SMS_FALLBACK $EnableSmsFallback
  zavu fn secrets set CELO_RPC_URL $CeloRpcUrl
  zavu fn secrets set AIDTRACE_CONTRACT $ContractAddress
  zavu fn secrets set RELAYER_PRIVATE_KEY $relayerPrivateKey
  zavu fn secrets set APP_BASE_URL $AppBaseUrl
  zavu fn triggers add --events message.inbound --senders $SenderId
  zavu deploy
} finally {
  Pop-Location
}

Write-Host "Zavu relayer deployed from $functionDir"
