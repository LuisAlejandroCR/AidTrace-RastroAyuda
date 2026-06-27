param(
  [ValidateSet("sepolia", "mainnet")]
  [string] $Network = "sepolia",

  [string] $Admin = "0x326F24884FAFA1810034F4F6Dd41d280fB500569",

  [string] $PrivateKeyEnv = "DEPLOYER_PRIVATE_KEY",

  [string] $RpcUrl = ""
)

$ErrorActionPreference = "Stop"

if (-not $RpcUrl) {
  if ($Network -eq "mainnet") {
    $RpcUrl = "https://forno.celo.org"
  } else {
    $RpcUrl = "https://forno.celo-sepolia.celo-testnet.org"
  }
}

$privateKey = [Environment]::GetEnvironmentVariable($PrivateKeyEnv)
if (-not $privateKey) {
  throw "Set `$env:$PrivateKeyEnv before running this script."
}

if (-not (Get-Command forge -ErrorAction SilentlyContinue)) {
  throw "Foundry forge was not found. Install Foundry first: https://book.getfoundry.sh/getting-started/installation"
}

Write-Host "Deploying AidTraceLedger to $Network"
Write-Host "RPC: $RpcUrl"
Write-Host "Admin: $Admin"

forge create `
  --rpc-url $RpcUrl `
  --private-key $privateKey `
  AidTraceLedger.sol:AidTraceLedger `
  --constructor-args $Admin
