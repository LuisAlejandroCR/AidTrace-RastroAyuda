# scripts/invent-setup.md

# Invent Channel Setup Runbook
## WhatsApp Business + SMS for AidTrace

This runbook covers everything needed to activate the Invent channel adapter
(`/api/invent`) end-to-end. Follow the blocks in order.

---

## Prerequisites

- [ ] Invent account at https://useinvent.com
- [ ] WhatsApp Business phone number (see Block A for options)
- [ ] Vercel deployment of AidTrace with latest code (including `api/invent.mjs`)
- [ ] Supabase queue table deployed (`supabase/aidtrace_queue.sql` executed)

---

## Block A — Connect WhatsApp Business in Invent

**Choose your path:**

**Coexistence (recommended for existing numbers):**
- Your number is already on the WhatsApp Business app on a phone.
- You keep using the app; the assistant answers automatically alongside you.
- On every Invent assistant → Channels tab → WhatsApp Business → Connect.
- In Meta's Embedded Signup: Business portfolio (auto-detected) → pick
  "Connect a WhatsApp Business App" → enter your number → scan QR from the app.
- Name the connection (e.g. "AidTrace Venezuela").
- ⚠️ Open the WhatsApp Business app at least once every 14 days or the API link breaks.

**API-only (new number, fully automated):**
- The number is not in use on any WhatsApp account.
- On every Invent assistant → Channels tab → WhatsApp Business → Connect.
- In Meta's Embedded Signup: pick "Create a WhatsApp Business account".
- Enter the new number, display name (e.g. "AidTrace"), verify via SMS.
- No 14-day maintenance requirement.

**Acceptance:** Send a WhatsApp message to the connected number → the Invent
assistant replies (before the AidTrace action is wired).

---

## Block B — Create the Invent Assistant

1. Invent dashboard → Assistants → New Assistant.
2. Name: `AidTrace Campo` (or any name that makes sense to field workers).
3. Instructions (paste exactly):
   ```
   Eres AidTrace, el sistema de rastreo de ayuda humanitaria.

   Cuando un usuario envíe un comando de custodia (un mensaje que empiece con
   CELO, LOTE o AT-CELO seguido de un verbo de acción como depositar, entregar,
   recoger o revisar), llama inmediatamente la acción "Registrar Evento de
   Custodia" sin pedir confirmación y sin parafrasear.

   Pasá el mensaje original completo al campo "message" de la acción.

   Si el mensaje no es un comando de custodia (por ejemplo, un saludo o una
   pregunta), responde de forma amable y mostrá este ejemplo:
   "Para registrar una entrega escribí: CELO1 entregar 50 cajas de agua refugio norte"

   Comandos válidos:
   - CELO1 depositar [cantidad] [descripción] [lugar]
   - CELO1 entregar  [cantidad] [descripción] [lugar]
   - CELO1 recoger   [lugar]
   - CELO1 revisar   [nota]

   Aliases: LOTE 1, AT-CELO-1 equivalen a CELO1.
   ```
4. Language: Spanish.
5. Save.

---

## Block C — Configure the "Record Custody Event" Action

1. In the assistant → Actions tab → Add Action.
2. Integration: **HTTP Request** (or "Call API endpoint").
3. Action name: `Registrar Evento de Custodia`.
4. When to use: `When the user sends a custody command starting with CELO, LOTE, or AT-`.
5. Method: `POST`.
6. URL: `https://aidtrace-rastroayuda.vercel.app/api/invent`
7. Headers:
   ```
   X-AidTrace-Invent-Token: <AIDTRACE_INVENT_WEBHOOK_TOKEN value from Vercel>
   Content-Type: application/json
   ```
8. Body (JSON template — Invent fills these from conversation context):
   ```json
   {
     "contact_id":   "{{contact.id}}",
     "contact_name": "{{contact.name}}",
     "channel":      "{{channel.type}}",
     "phone":        "{{contact.phone}}",
     "message":      "{{message.text}}"
   }
   ```
9. Save action.

**Acceptance:** Send `CELO1 depositar 10 cajas de agua` via WhatsApp to the
connected number → Invent calls `/api/invent` → you see a queued or direct
acknowledgement reply.

---

## Block D — Set Vercel Environment Variables

Add these to your Vercel project (Settings → Environment Variables):

```
AIDTRACE_INVENT_WEBHOOK_TOKEN=<generate a long random token — same value as in Block C step 7>
AIDTRACE_INVENT_API_KEY=<from Invent dashboard Settings → API Keys>
```

`AIDTRACE_INVENT_API_KEY` is used by `api/invent-notify.mjs` to send the
final tx-hash reply back to the user after the queue worker processes the
Celo write.  If not set, the acknowledgement reply ("En cola…") is still
delivered immediately; only the final tx-hash delivery is skipped.

Redeploy after adding the variables.

---

## Block E — Run the Smoke Check

```powershell
$env:AIDTRACE_INVENT_WEBHOOK_TOKEN = "<same token>"
.\scripts\invent-smoke-check.ps1 `
  -BaseUrl "https://aidtrace-rastroayuda.vercel.app" `
  -Token   $env:AIDTRACE_INVENT_WEBHOOK_TOKEN
```

All 6 checks should PASS.

---

## Block F — Connect SMS (optional, later)

Invent supports SMS via Twilio integration (Settings → Connections → Twilio).

1. Connect your Twilio account in Invent Connections.
2. In the same assistant → Channels → Add another → SMS → pick the Twilio number.
3. No extra code changes needed — `/api/invent` already handles `channel: "sms"`.
4. SMS replies are automatically shortened (under 320 chars, no markdown bold).

---

## Block G — Add to AUDIT_BLOCKS.md

Add a new task entry after P2-05:

```
P2-06 - Invent WhatsApp / SMS channel
Status: [PENDING / PASSED after smoke check]
Why: reaches field workers who use WhatsApp or SMS instead of Telegram.
Files: api/invent.mjs, api/invent-notify.mjs, test/invent-channel.test.mjs,
       scripts/invent-smoke-check.ps1, scripts/invent-setup.md.
Envs:  AIDTRACE_INVENT_WEBHOOK_TOKEN, AIDTRACE_INVENT_API_KEY
Action: run invent-smoke-check.ps1 after deploy.
Acceptance: smoke check passes; WhatsApp custody command queued and Celo tx
            delivered; final reply received on WhatsApp with Celoscan link.
```

---

## Rollback

If something breaks:

1. In Invent dashboard → assistant → Actions → disable "Registrar Evento de Custodia".
2. Remove `AIDTRACE_INVENT_WEBHOOK_TOKEN` from Vercel and redeploy.
3. Telegram channel (Zavu) is unaffected — the two adapters are fully independent.
