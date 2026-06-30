# AidTrace Relayer Rotation Runbook

Use this only from a trusted machine. Never paste private keys in chats, screenshots, GitHub, or frontend files.

## Roles

```text
Contract: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934
Admin: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
Function: setSubmitter(address submitter, bool allowed)
```

`RastroAyuda_Admin` owns submitter permissions. `RASTROAYUDA_RELAYER_PRIVATE_KEY` must be a different hot key used only by the API worker.

## Prepare A New Relayer

Create a new wallet in your preferred wallet tool, then fund it with only enough Celo Mainnet balance for expected demo writes.

Set local variables:

```powershell
$env:AIDTRACE_CONTRACT="0xaf5c40e82ac9255479a1f447e81992b71c4f4934"
$env:CELO_RPC_URL="https://forno.celo.org"
$env:NEW_RELAYER_ADDRESS="<new relayer 0x address>"
$env:OLD_RELAYER_ADDRESS="<old relayer 0x address>"
$env:RastroAyuda_Admin_PRIVATE_KEY="<admin private key>"
```

## Grant New Relayer

```powershell
cast send $env:AIDTRACE_CONTRACT `
  "setSubmitter(address,bool)" `
  $env:NEW_RELAYER_ADDRESS true `
  --rpc-url $env:CELO_RPC_URL `
  --private-key $env:RastroAyuda_Admin_PRIVATE_KEY
```

Confirm:

```powershell
cast call $env:AIDTRACE_CONTRACT `
  "submitters(address)(bool)" `
  $env:NEW_RELAYER_ADDRESS `
  --rpc-url $env:CELO_RPC_URL
```

Expected:

```text
true
```

## Switch Vercel

Update Vercel:

```text
RASTROAYUDA_RELAYER_PRIVATE_KEY=<new relayer private key>
```

Redeploy the app, then send one Telegram test and process the queue:

```text
CELO1 revisar prueba rotacion relayer
```

```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://aidtrace-rastroayuda.vercel.app/api/process-queue?limit=1" `
  -Headers @{ "X-AidTrace-Worker-Token" = $env:AIDTRACE_QUEUE_WORKER_TOKEN }
```

Confirm the returned transaction succeeds on Celoscan.

## Revoke Old Relayer

Only revoke after the new relayer writes successfully.

```powershell
cast send $env:AIDTRACE_CONTRACT `
  "setSubmitter(address,bool)" `
  $env:OLD_RELAYER_ADDRESS false `
  --rpc-url $env:CELO_RPC_URL `
  --private-key $env:RastroAyuda_Admin_PRIVATE_KEY
```

Confirm:

```powershell
cast call $env:AIDTRACE_CONTRACT `
  "submitters(address)(bool)" `
  $env:OLD_RELAYER_ADDRESS `
  --rpc-url $env:CELO_RPC_URL
```

Expected:

```text
false
```

## Emergency Response

If the relayer key is exposed:

1. Grant a new relayer.
2. Switch Vercel to the new key.
3. Revoke the old relayer.
4. Check Celoscan for unexpected `AidTraceEvent` logs.
5. Reduce funds on the old relayer wallet if possible.

Do not rotate the admin key during a demo unless the admin key itself is exposed. Admin rotation uses `transferAdmin(address)` and should be done with extra care.
