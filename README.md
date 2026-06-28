# AidTrace | RastroAyuda

AidTrace helps relief teams create QR labels, record custody updates, and prove what happened to humanitarian supplies. The app works in a mobile or desktop browser, keeps records locally when internet is weak, and saves verified proofs on Celo when connectivity returns.

Telegram is available today for text reports from field operators. SMS and WhatsApp are planned as future channel adapters.

## Why It Matters

After earthquakes, floods, or similar disasters, people need to know where water, food, medicine, and shelter kits are moving. Paper notes get lost, connectivity fails, and donors cannot easily audit delivery.

AidTrace gives each aid batch a short code and QR label. Every pickup, delivery, or review creates a proof that can be checked on Celo without asking field users to hold a wallet or pay network fees.

## How The App Layer Works

1. A coordinator opens AidTrace and creates a new aid batch.
2. AidTrace generates a QR label with a short batch code.
3. Field teams scan the QR or type the batch code to add updates.
4. If the browser is offline, the update stays on the device.
5. When the browser is online again, AidTrace syncs pending proofs automatically.
6. Supervisors open the timeline and audit each proof through the Celo transaction link.

The app also supports Telegram reports. If a field user has mobile data but cannot use the browser, they can send a simple text message to the bot.

## Offline Behavior

AidTrace is designed for damaged or unstable networks:

- Browser records are stored locally first.
- Pending records sync automatically when internet returns.
- The app warns before closing or reloading while offline or while proofs are still pending.
- Telegram can queue messages while a user is offline; when Telegram reconnects, the backend processes the messages one by one before writing them to Celo.

No field user needs to connect a wallet, hold CELO, or pay fees.

## Browser Use

Create a QR label:

1. Open AidTrace.
2. Select the supply type.
3. Add quantity, origin, destination, and notes.
4. Press `Create QR`.
5. Save or print the QR label.

Record a custody update:

1. Scan the QR or open the `Update` screen.
2. Choose the action.
3. Add operator, location, and evidence note.
4. Press `Save label`.
5. If offline, keep working. AidTrace will sync automatically later.

Audit:

1. Open `Timeline` / `Historial`.
2. Open `View Celo transaction` / `Ver transaccion en Celo`.
3. In Celoscan, go to `Logs`.
4. Scroll to `data` / `referenceURI`.
5. Read the public audit memo.

Example public memo:

```text
zavu:<message_id> | DELIVER AT-CELO-1 | 100 aguas refugio mayor
```

## Telegram Use

Use short natural commands. The first number belongs to the batch code; numbers after the action are treated as details.

Note: CELO1 is a keyword to help Telegram bot identify the batch id

Examples:

```text
CELO1 depositar 100 aguas refugio mayor
CELO1 entregar 15 kits refugio mayor
CELO1 recoger centro de acopio norte
CELO1 revisar faltan 3 cajas
```

Main words:

```text
depositar / entregar -> delivery proof
recoger / recibir    -> pickup proof
revisar / reporte    -> review or issue proof
CELO1 / LOTE 1       -> short batch code for AT-CELO-1
```

Bot reply:

```text
Registrado en Celo: DELIVER AT-CELO-1
Detalles: 100 aguas refugio mayor
Tx: https://celoscan.io/tx/<tx_hash>
Auditoria: abre el link, ve a Logs y baja hasta data / referenceURI.
```

## Current Live Setup

```text
Network: Celo Mainnet
Chain ID: 42220
RPC: https://forno.celo.org
Contract: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934
Admin and funding wallet: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

Donor funding standard:

```text
USDC on Celo: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
USDC fee adapter for relayer txs: 0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
```

Zavu channel policy:

```text
Live demo: Telegram
Browser fallback: offline-first PWA queue
Future fallback: two-way SMS
Future operator flow: WhatsApp Business
```

## Developer Summary

Architecture:

```text
Static PWA -> /api/zavu relayer -> AidTraceLedger on Celo
Telegram inbound -> Zavu webhook -> /api/zavu -> AidTraceLedger on Celo
/api/timeline -> reads AidTraceLedger logs -> browser timeline
Supabase Postgres lock -> serializes Celo writes from the relayer wallet
```

Project files:

```text
index.html                  Static app shell and timeline controls
styles.css                  Responsive UI, mobile form behavior, print styles
app.js                      PWA state, offline queue, QR/PDF, timeline rendering
sw.js                       Service worker cache and background sync handoff
qrcode.js                   Local QR generator
api/zavu.mjs                Browser relay endpoint and Zavu Telegram webhook
api/timeline.mjs            Celo log reader for timeline hydration
contracts/AidTraceLedger.sol On-chain proof ledger
scripts/send-zavu-message.mjs Outbound channel smoke test
```

```

Local static preview:

```powershell
npx serve .
```

## Contract Notes

`CONTRACT_ADDRESS` must be the deployed `AidTraceLedger` address. It is not the admin wallet.

The contract is already verified:

```text
https://celoscan.io/address/0xaf5c40e82ac9255479a1f447e81992b71c4f4934#code
```

Use the existing contract for new flows. Avoid redeploying just to add labels, parser words, or new off-chain metadata.

## Test Path

1. Create a QR in the browser.
2. Save or print the label.
3. Open the QR on mobile and add a custody event.
4. Switch offline and add another event.
5. Restore internet and confirm automatic sync.
6. Send Telegram: `CELO1 depositar 100 aguas refugio mayor`.
7. Confirm the bot replies with a Celoscan transaction link.
8. Open the transaction and inspect `referenceURI`.
9. Confirm the event appears in the app timeline.

## Notes

Zavu credits and Celo relayer funds are separate. Zavu is paid through the dashboard. Celo relayer fees are funded through the project wallet.

Field users should not handle private keys, wallets, CELO, or network fees.
