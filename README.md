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
api/process-queue.mjs       Protected queue worker that processes one Supabase queued Celo write per call
api/timeline.mjs            Celo timeline reader with Supabase index fallback
AidTraceLedger.sol          On-chain proof ledger
scripts/send-zavu-message.mjs Outbound channel smoke test
supabase/aidtrace_queue.sql Supabase durable queue table and RPCs for serialized Celo writes
supabase/aidtrace_timeline.sql Supabase indexed timeline cache for bounded reads
```

Security/readiness audit:

```text
AUDIT_BLOCKS.md             Blocked audit plan for relay auth, queue, timeline indexing, key rotation, CORS, tests, CI, and PWA installability
```

The final pending task registry is kept at the end of `AUDIT_BLOCKS.md` with task IDs, priorities, files/envs, and acceptance checks. Check it before deploying or presenting, especially `P0-01 - AIDTRACE_WEBHOOK_TOKEN`.

Local static preview:

```powershell
npx serve .
```

Required Vercel envs:

```text
AIDTRACE_CONTRACT=0xaf5c40e82ac9255479a1f447e81992b71c4f4934
AIDTRACE_ALLOWED_ORIGINS=https://aidtrace-rastroayuda.vercel.app,http://127.0.0.1:8017,http://localhost:8017
AIDTRACE_MAX_BROWSER_RELAY_ITEMS=20
RASTROAYUDA_RELAYER_PRIVATE_KEY=<relayer private key, not admin key>
RASTROAYUDA_ZAVU_API_KEY=<zv_live_...>
SUPABASE_URL=<project url>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Optional timeline index env:

```text
AIDTRACE_TIMELINE_INDEX_ENABLED=true
```

Timeline indexing is enabled automatically when Supabase service envs exist. Set `AIDTRACE_TIMELINE_INDEX_ENABLED=false` only if you need to fall back to direct Celo log scans.

Optional durable queue envs:

```text
AIDTRACE_QUEUE_ENABLED=true
AIDTRACE_QUEUE_WORKER_TOKEN=<random long token>
AIDTRACE_QUEUE_LOCK_SECONDS=120
AIDTRACE_QUEUE_MAX_ATTEMPTS=8
AIDTRACE_QUEUE_BATCH_SIZE=3
```

Only enable `AIDTRACE_QUEUE_ENABLED=true` after `supabase/aidtrace_queue.sql` has been run in Supabase. This queues Telegram/Zavu inbound messages so reconnect bursts are processed one by one. Browser offline proofs still use the direct relay path and return a transaction hash to the UI.

The protected worker endpoint is `POST /api/process-queue` with `X-AidTrace-Worker-Token: <token>` or `Authorization: Bearer <token>`.

Manual worker smoke test:

```powershell
$env:AIDTRACE_QUEUE_WORKER_TOKEN="<same token used in Vercel>"
Invoke-RestMethod -Method POST `
  -Uri "https://aidtrace-rastroayuda.vercel.app/api/process-queue?limit=3" `
  -Headers @{ "X-AidTrace-Worker-Token" = $env:AIDTRACE_QUEUE_WORKER_TOKEN }
```

Optional browser queue flag:

```text
AIDTRACE_BROWSER_QUEUE_ENABLED=true
```

Leave `AIDTRACE_BROWSER_QUEUE_ENABLED` unset for the demo unless the UI is updated to track queued browser proofs without an immediate transaction hash.

Supabase queue setup:

```text
Run supabase/aidtrace_queue.sql in the Supabase SQL editor before wiring queue-backed processing.
Run supabase/aidtrace_timeline.sql in the Supabase SQL editor before using indexed timeline reads.
```

Optional webhook hardening:

```text
AIDTRACE_WEBHOOK_TOKEN=<random long token>
```

Only set `AIDTRACE_WEBHOOK_TOKEN` after Zavu is configured to send the same value as `X-AidTrace-Webhook-Token` or `Authorization: Bearer <token>` with inbound webhook requests.

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
10. Call `/api/timeline?limit=30` twice and confirm the second call returns from the indexed cache without a full historical scan.

## Notes

Zavu credits and Celo relayer funds are separate. Zavu is paid through the dashboard. Celo relayer fees are funded through the project wallet.

Field users should not handle private keys, wallets, CELO, or network fees.
