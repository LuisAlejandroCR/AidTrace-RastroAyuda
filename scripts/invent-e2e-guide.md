# Testing WhatsApp/SMS (Invent) end-to-end

This mirrors how Telegram testing works but with Invent.

---

## How Telegram works (reference)

```
You send msg to bot
     ↓
Zavu webhook → POST /api/zavu  (synchronous)
     ↓
recordOnCelo() writes tx
     ↓
Zavu sends reply with tx hash  (<30 sec total)
```

## How WhatsApp/SMS works (Invent)

```
You send msg to Invent number
     ↓
Invent HTTP action → POST /api/invent  (validates token, parses command)
     ↓
enqueueSupabase() → aidtrace_message_queue row (status: pending)
     ↓
GitHub Actions process-queue.yml fires every 5 min
     ↓
_processInventQueueRow() → Celo write → row status: completed
     ↓
sendInventReply() → Invent API → WhatsApp/SMS reply with tx link
```

Key difference: **up to 5 min queue delay** before the Celo write and reply.
To test faster, trigger the queue worker manually (see step 4 below).

---

## Step 1 — Confirm Invent is wired up

Run the smoke check — it POSTs directly to /api/invent without going through WhatsApp:

```powershell
.\scripts\invent-smoke-check.ps1 `
  -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
  -Token   $env:AIDTRACE_INVENT_WEBHOOK_TOKEN
```

Expected: 6/6 PASS. If test 5 or 6 fail, re-check `AIDTRACE_INVENT_WEBHOOK_TOKEN` in Vercel matches the token you are passing.

---

## Step 2 — Send a real WhatsApp message

1. From your personal WhatsApp, send to the Invent business number:
   ```
   CELO1 depositar 20 cajas agua CENTRO-NORTE-1
   ```
2. Invent should auto-reply immediately: *"En proceso… recibirás confirmación en breve."*
   - This reply comes from `api/invent.mjs` synchronously.
   - If you don't see it: check Invent → Conversations → look for the message. If it's there but no reply, the HTTP action may be misconfigured — check the header name and value.

---

## Step 3 — Monitor the Supabase queue

Open Supabase → SQL Editor:

```sql
select id, channel, source, batch_id, action_type, status, retry_count, updated_at
from aidtrace_message_queue
order by created_at desc
limit 5;
```

You should see a row with:
- `channel` = `invent_whatsapp`
- `status` = `pending` (will flip to `completed` once the worker runs)

---

## Step 4 — Trigger the queue worker manually (skip the 5-min wait)

Option A — GitHub Actions workflow dispatch (easiest):
1. Go to your GitHub repo → Actions → "Process AidTrace queue"
2. Click "Run workflow" → Run
3. Wait ~30 sec → check the run logs for `[invent] reply sent to chat`

Option B — Run locally with the same env vars as production:
```powershell
# From the AidTrace-RastroAyuda directory
$env:SUPABASE_URL = "..."
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:RASTROAYUDA_ZAVU_API_KEY = "..."
$env:AIDTRACE_INVENT_API_KEY = "..."
$env:CONTRACT_ADDRESS = "0xaf5c40e82ac9255479a1f447e81992b71c4f4934"
$env:RELAYER_PRIVATE_KEY = "..."
$env:CELO_RPC_URL = "https://forno.celo.org"

node api/process-queue.mjs
```

---

## Step 5 — Verify the reply on WhatsApp

After the worker runs, you should receive a WhatsApp message:

```
✅ Registrado en Celo: DEPOSITAR CELO1
📦 Detalles: 20 cajas agua CENTRO-NORTE-1
🔗 Tx: https://celoscan.io/tx/0x...
🔍 Auditoría: abrí el link → Logs → data / referenceURI
```

For SMS, the reply is shorter: `AidTrace OK: DEPOSITAR CELO1. Tx: https://celoscan.io/tx/0x...`

---

## Step 6 — Verify on-chain and in center inventory

```powershell
# Check the tx appeared on Celoscan
Start-Process "https://celoscan.io/address/0xaf5c40e82ac9255479a1f447e81992b71c4f4934"

# Check center inventory picked up the CENTRO-NORTE-1 code
Invoke-RestMethod "https://aidtrace-rastroayuda.vercel.app/api/center-inventory?center=CENTRO-NORTE-1" | ConvertTo-Json -Depth 5
```

Expected: `count >= 1` with a row containing your `batchId` and a `txHash`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No immediate reply from Invent | HTTP action misconfigured | Invent → Actions → check URL + header |
| Supabase row stays `pending` forever | GitHub Actions secret missing or process-queue.mjs error | Check Actions run logs |
| `[invent] reply failed` in logs | `AIDTRACE_INVENT_API_KEY` wrong or chat_id missing | Check Vercel env vars; check payload.chatId in Supabase row |
| Center inventory empty | Center code not detected in message text | Message must contain `CENTRO-*`, `CENTER-*`, `CC-*`, or `DIST-*` pattern |
| Worker claims row but Celo write fails | `RELAYER_PRIVATE_KEY` not set in GitHub secret | Add secret to repo → re-run workflow |

---

## SMS test (same flow, shorter message)

Send via SMS to the Invent number:
```
CELO1 entregar 5 kits CENTRO-SUR-1
```

The reply is capped at 160 chars:
```
AidTrace OK: ENTREGAR CELO1. Tx: https://celoscan.io/tx/0x...
```
