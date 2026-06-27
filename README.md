# AidTrace | RastroAyuda

Offline-first custody tracking for humanitarian supplies, anchored on Celo.

## Product direction

AidTrace is the global name. RastroAyuda is the Spanish subtitle for LATAM users.

The app is UI-first:

1. Create an aid batch.
2. Print or share the generated QR / `AT-...` code.
3. Field operators record custody events from mobile or desktop.
4. Events stay local when internet is damaged.
5. When internet returns, the app sends pending proofs to a Zavu/webhook relayer.
6. The relayer submits the proof hash to Celo.

Field users do not need a wallet and do not manually sync.

## QR strategy

AidTrace should support both printing and reading QR codes.

- **Print QR**: the QR is the physical label for a box, pallet, medicine kit, or convoy manifest.
- **Read QR**: field users scan the QR with the phone camera; it opens AidTrace with the batch code already filled.

The QR encodes a URL with `?batch=AT-...`, not only raw text. If the phone camera cannot open the app, the visible `AT-...` code can still be typed manually or sent by SMS/WhatsApp.

## Zavu SMS / WhatsApp flow

Yes, this can work on 2G/3G through WhatsApp or SMS. Use Zavu as the communications and ingestion layer:

1. Field user sends WhatsApp or SMS to the AidTrace number.
2. Zavu receives the inbound message and forwards it to an AidTrace webhook.
3. The webhook parses a compact command:

```text
AT DELIVER AT-ABC-123 REFUGIO-SAN-JOSE 20 water boxes
AT PICKUP AT-ABC-123 CENTRO-CHACAO
AT REVIEW AT-ABC-123 missing 2 boxes
```

4. The webhook normalizes the action into the same event schema used by the PWA.
5. The webhook stores the full event off-chain and submits only the proof hash to Celo.
6. Zavu replies with a confirmation message and the batch code.

For low bandwidth, keep commands short and text-only. Avoid photos unless needed for proof review.

Zavu rules to respect:

- Use E.164 phone numbers, for example `+584121234567`.
- Prefer `channel: "auto"` so Zavu can try WhatsApp and fall back to SMS.
- Use `idempotencyKey` based on the inbound message id plus batch code to avoid duplicate custody events.
- WhatsApp free-form replies require a 24h user-initiated window. Use templates for outbound messages outside that window.
- SMS messages with URLs require verified URLs. Avoid shorteners.

## Celo tracking architecture

The browser should not be responsible for mainnet transactions. It queues local proofs and sends relay packets to a backend/Zavu Function when online.

Recommended relay flow:

1. PWA stores event locally.
2. PWA posts a relay packet to the configured webhook.
3. Relayer validates the event and sender.
4. Relayer calls `AidTraceLedger.recordAction(...)`.
5. Relayer pays the Celo network fee with a standard fee token.
6. Relayer sends confirmation through Zavu.

This keeps Celo behind the tracking flow while preserving public auditability.

## App configuration

The field UI intentionally has no Settings screen. Configure deployment values in `app.js` before release:

```js
const CONTRACT_ADDRESS = "0x..."; // Deployed AidTraceLedger contract.
const RELAY_ENDPOINT = "https://your-zavu-or-backend-webhook.example/sync";
```

If `RELAY_ENDPOINT` is empty, the app still stores everything locally and shows the offline/queued state, but it cannot auto-sync until configured.

Do not set `CONTRACT_ADDRESS` to the funding wallet. It must be the deployed `AidTraceLedger` contract address.

## Funding wallet and fee standard

Funding wallet:

```text
0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

Standardize on **USDC on Celo** for relayer network fees and donor gas support.

- Donors send canonical Celo USDC to the funding wallet.
- USDC token address on Celo: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- Relayer transaction `feeCurrency` address: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`

Important: donors send to the **USDC token address** through their wallet UI. The relayer uses the **feeCurrency adapter address** in the transaction.

## Zavu credits

Zavu currently accepts credit card payments for messaging credits. Do not tell donors to send stablecoins directly to Zavu.

Recommended setup:

- Use the Celo USDC funding wallet for blockchain relayer fees.
- Use a project owner, NGO, or fiscal sponsor credit card for Zavu credits.
- If donors send USDC for Zavu costs, treat that as treasury funding; the project operator still has to pay Zavu by card.

## Network choice

Default demo network: **Celo Sepolia**.

Production network: **Celo Mainnet** with a sponsor relayer. The field user should not connect a wallet or hold CELO.

## Mainnet setup

- Admin / funding wallet: `0x326F24884FAFA1810034F4F6Dd41d280fB500569`
- Message platform: https://dashboard.zavu.dev/
- Mainnet chain ID: `42220`
- Sepolia chain ID: `11142220`

Deploy `AidTraceLedger.sol` with:

```text
constructor argument: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

After deployment, paste the contract address into the System screen or hardcode it in the relayer.

## Why sender matters

Sender is important because the same QR can be seen by many people. AidTrace records:

- Field sender: the human/operator/team typed into the form or inferred from phone number.
- Submitter: the backend wallet or relayer that submitted the proof on Celo.

This lets supervisors audit suspicious handoffs without exposing sensitive personal data.

## Avoiding redeploys

The contract emits generic events:

- `batchId`
- `actionType`
- `dataHash`
- `referenceURI`
- `schemaVersion`
- `flags`

New flows should add new action types and schemas off-chain instead of changing Solidity. Examples:

- `COLD_CHAIN_CHECK`
- `SHELTER_AUDIT`
- `SMS_CONFIRMED`
- `PHOTO_VERIFIED`
- `HANDOFF_REJECTED`

The on-chain layer stays stable; the UI and Zavu automation can evolve.

## Push to GitHub

From the repo root:

```bash
git status
git add .gitignore aidtrace
git commit -m "Improve AidTrace offline sync and Zavu flow"
git push origin main
```

## Local cleanup before push

Keep these files/folders out of the repo:

- `.agents/`
- `node_modules/`
- `qr-lib/`
- `selector-check/`
- `skills-lock.json`
- temporary `outputs/` or `work/` folders

The repo should mainly contain:

- `index.html`
- `styles.css`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `qrcode.js`
- `AidTraceLedger.sol`
- `README.md`
- `.gitignore`
