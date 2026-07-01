# AidTrace Deployment Checklist

Complete this checklist top-to-bottom before calling a deployment production-ready.
Each section maps to a plan block. Tick items in order — some depend on earlier ones.

---

## 0. Prerequisites

- [ ] `npm run test` — all tests green locally
- [ ] `npm run check` — no syntax errors
- [ ] Vercel project linked (`vercel link`)
- [ ] Supabase project exists and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel

---

## 1. Supabase schema (run once, safe to re-run)

Open Supabase → SQL Editor → run each file **in order**:

- [ ] `supabase/aidtrace_relay_guard.sql` — browser relay idempotency + rate-limit tables (now includes device ID column)
- [ ] `supabase/aidtrace_access_control.sql` — sender allowlist + hourly rate buckets
- [ ] `supabase/aidtrace_queue.sql` — message queue table + RPCs
- [ ] `supabase/aidtrace_timeline.sql` — timeline cache tables (required by `/api/timeline`)
- [ ] `supabase/aidtrace_queue_retry.sql` — `retry_aidtrace_message(uuid)` RPC
- [ ] `supabase/center_inventory.sql` — center inventory table + `record_center_delivery` RPC
- [ ] `supabase/center_summary.sql` — `get_center_summary()` aggregate RPC

Verify:
```sql
select count(*) from aidtrace_message_queue;                        -- table exists
select count(*) from aidtrace_timeline_events;                      -- table exists
select count(*) from aidtrace_center_inventory;                     -- table exists
select count(*) from aidtrace_allowed_senders;                      -- table exists (0 rows)
select record_center_delivery('CENTRO-TEST','BATCH-1');             -- {"ok":true,...}
select retry_aidtrace_message('00000000-0000-0000-0000-000000000000'::uuid); -- {"ok":false,...}
select * from get_center_summary() limit 5;                         -- empty or rows
```

---

## 2. Vercel environment variables

Set all of these in Vercel → Settings → Environment Variables.
Prefix `NEXT_PUBLIC_` only where shown — everything else is server-only.

### Contract / RPC (Block A)
| Variable | Value |
|---|---|
| `CONTRACT_ADDRESS` | `0xaf5c40e82ac9255479a1f447e81992b71c4f4934` |
| `RELAYER_PRIVATE_KEY` | your funded Celo wallet private key |
| `CELO_RPC_URL` | `https://forno.celo.org` |
| `CELOSCAN_TX_BASE` | `https://celoscan.io/tx` |

### Browser relay auth (Block A)
| Variable | Value |
|---|---|
| `AIDTRACE_BROWSER_RELAY_TOKEN` | any random string — set same in `app.js` RELAY_TOKEN |
| `AIDTRACE_ALLOWED_ORIGINS` | `https://aidtrace-rastroayuda.vercel.app` (comma-separated for extra domains) |

### Supabase (Blocks A + F)
| Variable | Value |
|---|---|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server-only — never `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_SUPABASE_URL` | same URL — used by the PWA for public reads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |

### Zavu / Telegram (Block E — Telegram channel)
| Variable | Value |
|---|---|
| `RASTROAYUDA_ZAVU_API_KEY` | Zavu API key (Zavu dashboard → Settings → API Keys) |
| `AIDTRACE_ZAVU_WEBHOOK_SECRET` | Zavu webhook secret (Zavu → Webhook → Secret) |
| `AIDTRACE_INVENT_FALLBACK_ZAVU_CHAT` | Zavu chat ID for fallback Telegram alerts |

**How to get `AIDTRACE_INVENT_FALLBACK_ZAVU_CHAT`:**
Zavu dashboard → Conversations → send any message to your AidTrace bot from the alert account → copy the chat ID from the conversation URL.

### Invent / WhatsApp + SMS (Block E — WhatsApp/SMS channel)
| Variable | Value |
|---|---|
| `AIDTRACE_INVENT_WEBHOOK_TOKEN` | random token — set same in Invent HTTP action header |
| `AIDTRACE_INVENT_API_KEY` | Invent API key (Invent → Settings → API Keys) |

### Center inventory webhook (Block F)
| Variable | Value |
|---|---|
| `AIDTRACE_CENTER_WEBHOOK_URL` | `https://aidtrace-rastroayuda.vercel.app/api/center-webhook` |
| `AIDTRACE_CENTER_WEBHOOK_SECRET` | random hex: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `AIDTRACE_CENTER_NOTIFY_CHAT` | Zavu chat ID to notify on center deliveries (same steps as FALLBACK_ZAVU_CHAT above) |

### Operator dashboard / retry (iteration 2)
| Variable | Value |
|---|---|
| `AIDTRACE_QUEUE_WORKER_TOKEN` | random token — also set in GitHub Actions secret of the same name |

This is already required by `process-queue.mjs`. It is the same token coordinators enter in the PWA retry panel (Timeline → Relay issues → Coordinator token).

### Anti-abuse (sender allowlist + device rate limiting)
| Variable | Value |
|---|---|
| `AIDTRACE_SENDER_ALLOWLIST_ENABLED` | `true` to enforce the Telegram/WhatsApp allowlist (default `false` — safe to enable once first field workers have registered) |
| `AIDTRACE_SENDER_RATE_LIMIT_HOUR` | max events per sender per hour, default `20` |
| `AIDTRACE_REGISTRATION_KEYWORD` | secret word field workers send once to self-register (e.g. generate with `node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"`) — distribute out-of-band |

**Self-registration flow:**
1. Coordinator distributes `AIDTRACE_REGISTRATION_KEYWORD` securely (WhatsApp, in person, etc.).
2. Field worker opens Telegram → sends the keyword to the AidTrace bot.
3. Bot replies "✅ Registrado" — they are added to `aidtrace_allowed_senders`.
4. All subsequent AidTrace events from that chat ID go through normally.

**To block a user:** `UPDATE aidtrace_allowed_senders SET is_active = false WHERE chat_id = '<id>';`

---

## 3. GitHub Actions secrets

In the GitHub repo → Settings → Secrets and variables → Actions:

- [ ] `RELAYER_PRIVATE_KEY` — same as Vercel
- [ ] `SUPABASE_URL` — same as Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — same as Vercel
- [ ] `AIDTRACE_INVENT_API_KEY` — same as Vercel
- [ ] `RASTROAYUDA_ZAVU_API_KEY` — same as Vercel
- [ ] `AIDTRACE_QUEUE_WORKER_TOKEN` — same as Vercel

These are used by `.github/workflows/process-queue.yml` (runs every 5 min).

---

## 4. Invent (WhatsApp/SMS) setup

Follow `scripts/invent-setup.md` fully. Key steps:

- [ ] Claim a WhatsApp Business number in Invent
- [ ] Create HTTP action pointing to `https://aidtrace-rastroayuda.vercel.app/api/invent`
- [ ] Set header `X-AidTrace-Invent-Token: <AIDTRACE_INVENT_WEBHOOK_TOKEN>`
- [ ] Test inbound → see `scripts/invent-e2e-guide.md`

---

## 5. Deploy and smoke-test

```powershell
# Deploy
vercel --prod

# Run all smoke tests (replace values with your own)
.\scripts\final-demo-check.ps1 -BaseUrl "https://aidtrace-rastroayuda.vercel.app"

.\scripts\invent-smoke-check.ps1 `
  -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
  -Token   $env:AIDTRACE_INVENT_WEBHOOK_TOKEN

.\scripts\center-webhook-smoke-check.ps1 `
  -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
  -Secret  $env:AIDTRACE_CENTER_WEBHOOK_SECRET

.\scripts\iteration2-smoke-check.ps1 `
  -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
  -Token   $env:AIDTRACE_QUEUE_WORKER_TOKEN
```

Expected: all scripts exit 0 and print only PASS lines.

---

## 6. End-to-end acceptance tests

### Telegram
1. If `AIDTRACE_SENDER_ALLOWLIST_ENABLED=true`: send `<AIDTRACE_REGISTRATION_KEYWORD>` → bot replies "✅ Registrado"
2. Send a custody event: `AT-CELO-1 DELIVERED 30 kits agua CENTRO-NORTE-1`
3. Bot replies "Recibido en cola" immediately; after the next GitHub Actions cron (≤5 min) a second reply arrives with the Celoscan tx link
4. `GET /api/center-inventory?center=CENTRO-NORTE-1` returns count ≥ 1

### WhatsApp
See `scripts/invent-e2e-guide.md` — full walkthrough including queue monitoring.

### Map view (PWA)
1. Open the PWA → tap "Map" tab
2. Tap "📍 GPS" in the event form → coordinates appear
3. Submit a custody event
4. Return to Map → marker appears at GPS location
5. "Centros de distribución" list shows below the map after first center delivery

### Operator dashboard (iteration 2)
1. `GET /api/queue-status` → `{ok:true, counts:{...}, workerHealthy:true}`
2. `GET /api/export?center=CENTRO-NORTE-1` → CSV file downloads
3. `GET /api/center-inventory?all=true` → `{ok:true, centers:[...]}`
4. Open PWA Timeline tab with a pending local event → gold badge appears on tab
5. Manually fail a queue row in Supabase (`update ... set status='failed'`) →
   open Timeline tab → "Relay issues" panel appears with Retry button

---

## 7. Post-deploy monitoring

- `GET /api/queue-status` — bookmark this; check `workerHealthy` and `counts.failed` daily
- Vercel Functions log: `vercel logs --prod` — watch for `[center-webhook]` and `[invent]` lines
- Supabase: `select status, count(*) from aidtrace_message_queue group by status` — failed > 0 needs attention
- GitHub Actions: `.github/workflows/process-queue.yml` — runs every 5 min — check last run status
- Celoscan: `https://celoscan.io/address/0xaf5c40e82ac9255479a1f447e81992b71c4f4934` — new events should appear
