# AidTrace | RastroAyuda

Offline-first custody tracking for humanitarian supplies, anchored on Celo and reachable through browser, SMS, or WhatsApp.

## Current Architecture

- Static PWA: creates QR labels, records custody events, stores pending events locally, and posts relay packets when online.
- Service worker: keeps queued relay packets for automatic background sync where the browser supports it.
- Zavu Function or backend relayer: receives browser sync and inbound SMS/WhatsApp, validates events, and writes proof hashes to Celo.
- `AidTraceLedger.sol`: stable on-chain audit log. Do not redeploy for new field flows; add new `actionType`, schema, and off-chain parsers.

`CONTRACT_ADDRESS` must be the deployed `AidTraceLedger` address. It is not the admin or funding wallet.

## Addresses

Admin and funding wallet:

```text
0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

Celo Mainnet:

```text
Chain ID: 42220
RPC: https://forno.celo.org
USDC token for donor funding: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
USDC feeCurrency adapter for relayer txs: 0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
```

Celo Sepolia:

```text
Chain ID: 11142220
RPC: https://forno.celo-sepolia.celo-testnet.org
```

Use Sepolia for the hackathon demo unless the relayer wallet, Zavu sender, and contract are production-ready.

## Block 1: Deploy Contract

Install Foundry, then deploy with the provided script:

```powershell
$env:DEPLOYER_PRIVATE_KEY = "0x..."
.\scripts\deploy-contract.ps1 -Network sepolia
```

Mainnet deployment:

```powershell
$env:DEPLOYER_PRIVATE_KEY = "0x..."
.\scripts\deploy-contract.ps1 -Network mainnet
```

The script deploys:

```text
AidTraceLedger.sol:AidTraceLedger
constructor argument: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

After deploy:

1. Copy the deployed contract address.
2. Set `CONTRACT_ADDRESS` in `app.js`.
3. Add the relayer wallet as submitter if it is different from the admin wallet.

```bash
cast send <CONTRACT_ADDRESS> \
  "setSubmitter(address,bool)" <RELAYER_ADDRESS> true \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org \
  --private-key $DEPLOYER_PRIVATE_KEY
```

For mainnet, use `https://forno.celo.org`.

## Block 2: Configure Browser App

Edit `app.js`:

```js
const CONTRACT_ADDRESS = "0x..."; // Deployed AidTraceLedger.
const RELAY_ENDPOINT = "";        // Fill after Zavu Function or backend is deployed.
```

If `RELAY_ENDPOINT` is empty, events remain local and the app can demo QR creation, labels, timeline, offline warnings, and queued states. Auto-sync starts only after a relay endpoint exists.

## Block 3: Setup Zavu

Create a Zavu sender in [dashboard.zavu.dev](https://dashboard.zavu.dev/) with SMS, WhatsApp, or both. Keep phone numbers in E.164 format.

The repo includes starter source in `zavu/aidtrace-relayer`. Create the Zavu Function workspace, then copy the starter source into it:

```bash
zavu login
zavu fn init aidtrace-relayer --template blank
cp -R zavu/aidtrace-relayer/* aidtrace-relayer/
cd aidtrace-relayer
```

Set secrets:

```bash
zavu fn secrets set SENDER_ID <zavu_sender_id>
zavu fn secrets set CELO_RPC_URL https://forno.celo-sepolia.celo-testnet.org
zavu fn secrets set AIDTRACE_CONTRACT <deployed_contract_address>
zavu fn secrets set RELAYER_PRIVATE_KEY 0x...
zavu fn secrets set APP_BASE_URL https://your-aidtrace-url.example
```

Add the inbound trigger and deploy:

```bash
zavu fn triggers add --events message.inbound --senders <zavu_sender_id>
zavu deploy
```

When Zavu gives you an HTTP endpoint or function URL for browser sync, set it as `RELAY_ENDPOINT` in `app.js`.

## Block 4: Zavu Message Contract

Inbound SMS/WhatsApp should be text-only and compact:

```text
AT DELIVER AT-ABC-123 REFUGIO-SAN-JOSE 20 water boxes
AT PICKUP AT-ABC-123 CENTRO-CHACAO
AT REVIEW AT-ABC-123 missing 2 boxes
```

Relayer behavior:

1. Parse command and batch id.
2. Normalize to the same event schema used by the PWA.
3. Hash the normalized event.
4. Call `recordAction(batchId, actionType, dataHash, sender, referenceURI)`.
5. Reply through Zavu with a short confirmation.

Use Zavu `idempotencyKey` from inbound `messageId + batchId + actionType` to avoid duplicate confirmations. Use the inbound phone number as the off-chain sender identity; do not put personal phone numbers directly on-chain.

## Block 5: Test Path

Run this order:

1. Create QR in the browser.
2. Save/print the label.
3. Open the QR URL on mobile and add a custody event.
4. Switch offline, add another event, and confirm it queues without user action.
5. Restore internet and confirm automatic sync toast.
6. Send an SMS/WhatsApp command to the Zavu sender.
7. Confirm the Celo event exists for the batch id.

Useful checks:

```bash
zavu fn invoke --event message.inbound --data '{"from":"+584121234567","text":"AT DELIVER AT-DEMO-001 REFUGIO 20 water boxes","messageId":"local-test-1","channel":"sms"}'
zavu fn logs --tail
cast logs --address <CONTRACT_ADDRESS> --rpc-url https://forno.celo-sepolia.celo-testnet.org
```

## Payment Notes

Donors can send Celo USDC to the funding wallet for relayer fee support. Zavu credits are separate: Zavu currently takes credit card payments, so project operators should fund Zavu from a card and treat donor stablecoins as treasury reimbursement if needed.

Field users should not connect a wallet, hold CELO, or pay fees. The relayer owns network fee payment.
