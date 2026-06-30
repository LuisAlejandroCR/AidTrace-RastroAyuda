# AidTrace Webhook Token Setup

Use this only after Zavu can send a custom header with inbound webhook calls.

## Generate Token

PowerShell:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$token
```

## Test Header Support Before Enabling

Use AidTrace's own probe endpoint first so you do not need a third-party request inspector.

1. Push/deploy `api/header-probe.mjs`.
2. Temporarily point the Zavu inbound webhook to:

```text
https://aidtrace-rastroayuda.vercel.app/api/header-probe
```

3. Configure Zavu to send this custom header:

```text
X-AidTrace-Webhook-Token: header-probe-only
```

4. Send one Telegram message to the bot.
5. Check the Zavu webhook/API log response or the Vercel function logs.

Expected result:

```text
hasAidTraceHeader: true
aidTraceHeaderLength: 17
```

If the header appears, Zavu can attach the header and it is safe to proceed with the real token. If the header does not appear, do not set `AIDTRACE_WEBHOOK_TOKEN` yet; Telegram inbound calls will be rejected by AidTrace.

After the probe, restore the Zavu inbound webhook URL to:

```text
https://aidtrace-rastroayuda.vercel.app/api/zavu
```

## Configure Vercel

Add this env var to Production:

```text
AIDTRACE_WEBHOOK_TOKEN=<token>
```

Redeploy after saving the env var.

## Configure Zavu

In the Zavu webhook or function delivery settings, add one of these headers to inbound webhook requests:

```text
X-AidTrace-Webhook-Token: <token>
```

or:

```text
Authorization: Bearer <token>
```

Do not put this token in browser code, Telegram messages, README examples, or GitHub.

## Verify

Send a Telegram message:

```text
CELO1 revisar prueba webhook token
```

Expected result:

```text
Registrado en Celo: REVIEW AT-CELO-1
Tx: https://celoscan.io/tx/<tx_hash>
```

If Telegram stops recording and Vercel logs show `401`, the Zavu header is missing or does not match. Remove `AIDTRACE_WEBHOOK_TOKEN` from Vercel, redeploy, and keep the endpoint protected by the current browser-origin, idempotency, rate-limit, and queue controls until Zavu custom headers are confirmed.
