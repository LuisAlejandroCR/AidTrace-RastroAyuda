# AidTrace | RastroAyuda

<p align="center">
  <strong>Prove what happened to humanitarian aid — on Celo.</strong>
</p>

<p align="center">
  QR labels, custody updates, and verifiable proofs for relief teams. Works in a mobile or desktop browser, keeps records locally when internet is weak, and writes tamper-evident proofs to Celo when connectivity returns — no wallet, CELO, or fees for field users.
</p>

<p align="center">
  <img alt="Celo Mainnet" src="https://img.shields.io/badge/Celo-Mainnet%2042220-35D07F">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-offline--first-5A67D8">
  <img alt="Telegram" src="https://img.shields.io/badge/Telegram-Zavu%20channel-26A5E4?logo=telegram&logoColor=white">
  <a href="https://github.com/LuisAlejandroCR/AidTrace-RastroAyuda/commits/main"><img alt="Último commit" src="https://img.shields.io/github/last-commit/LuisAlejandroCR/AidTrace-RastroAyuda?display_timestamp=committer&label=last%20commit"></a>
</p>

---

## Who Is AidTrace For

| Persona | What they do |
|:--|:--|
| **Field operator** | Scans the QR or sends a Telegram message to record pickups, deliveries, and reviews. |
| **Coordinator** | Creates aid batches, prints QR labels, assigns destinations. |
| **Supervisor** | Opens the timeline and audits every event on Celo. |
| **Donor** | Follows a transaction link and reads the public audit memo — no account needed. |

## How It Works

1. A coordinator creates a new aid batch — AidTrace generates a short code and a printable QR label.
2. Field teams scan the QR or type the batch code to add updates.
3. If the browser is offline, the update stays on the device and syncs automatically when internet returns.
4. Every update is written as a proof on **Celo Mainnet**.
5. Supervisors open the timeline and audit each proof through its transaction link.

> [!IMPORTANT]
> Field users never need a wallet, CELO, or network fees. AidTrace abstracts the chain completely — the relayer pays, the ledger proves, and anyone can audit with a link.

## Quick Start

Try the live demo: [aidtrace-rastroayuda.vercel.app](https://aidtrace-rastroayuda.vercel.app)

**Make a label**

1. Open AidTrace and select the supply type.
2. Add quantity, origin, destination, and notes.
3. Press `Create QR`, then save or print the label.

**Record a custody update**

1. Scan the QR or open the `Update` screen.
2. Choose the action, add operator, location, and evidence note.
3. Press `Save label`. If offline, keep working — it will sync later.

## Report From the Field With Telegram

Send a short text message. The first number is the batch code; words after the action are details.

```text
CELO1 depositar 100 cajas refugio mayor
CELO1 entregar 15 kits refugio mayor
CELO1 recoger centro de acopio norte
CELO1 revisar faltan 3 cajas
```

| Word | Meaning |
|:--|:--|
| `depositar` / `entregar` | delivery proof |
| `recoger` / `recibir` | pickup proof |
| `revisar` / `reporte` | review or issue proof |
| `CELO1` / `LOTE 1` | short code for batch `AT-CELO-1` |

The bot replies with a Celoscan link:

```text
Registrado en Celo: DELIVER AT-CELO-1
Detalles: 100 cajas refugio mayor
Tx: https://celoscan.io/tx/<tx_hash>
```

## Audit on Celo

1. Open `Timeline` / `Historial`.
2. Open `View Celo transaction` / `Ver transaccion en Celo`.
3. In Celoscan, go to `Logs` and scroll to `data` / `referenceURI`.

Example public memo:

```text
zavu:<message_id> | DELIVER AT-CELO-1 | 100 cajas refugio mayor
```

## Works Offline

- Records are stored locally first and sync automatically when internet returns.
- The app warns before closing while offline or with proofs still pending.
- Telegram messages queue while offline and are processed one by one when the connection returns.

## Live Network

```text
Network: Celo Mainnet · Chain ID: 42220 · RPC: https://forno.celo.org
Contract: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934 (verified on Celoscan)
Admin and funding wallet: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
USDC on Celo: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
USDC fee adapter for relayer txs: 0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
```

---

## For Developers (Minimum to Deploy)

**Local run**

```powershell
npx serve .
```

**Local verification**

```powershell
npm.cmd run test
npm.cmd run check
.\scripts\final-demo-check.ps1 -SkipRemote
```

**Vercel envs (required)**

```text
AIDTRACE_CONTRACT=0xaf5c40e82ac9255479a1f447e81992b71c4f4934
AIDTRACE_ALLOWED_ORIGINS=https://aidtrace-rastroayuda.vercel.app,http://localhost:8017,http://127.0.0.1:8017
AIDTRACE_MAX_BROWSER_RELAY_ITEMS=20
RASTROAYUDA_RELAYER_PRIVATE_KEY=<relayer private key, not admin key>
RASTROAYUDA_ZAVU_API_KEY=<zv_live_...>
SUPABASE_URL=<project url>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Optional: `AIDTRACE_RELAYER_ADDRESS` (defaults to live relayer), `AIDTRACE_WEBHOOK_TOKEN` (requires Zavu custom header support, see `scripts/webhook-token-setup.md`).

Optional anti-troll hardening — when set, field devices must pass a Cloudflare Turnstile widget and/or an email OTP before their proofs are accepted: `AIDTRACE_TURNSTILE_SITE_KEY` + `AIDTRACE_TURNSTILE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `AIDTRACE_REQUIRE_AUTH=true`.

**Supabase SQL setup** — run in order in the Supabase SQL editor:

```text
supabase/aidtrace_queue.sql
supabase/aidtrace_relay_guard.sql
supabase/aidtrace_timeline.sql
supabase/aidtrace_trust.sql          (anti-troll: trust schema + RLS + evidence hashing)
supabase/security_hardening.sql   (LAST — locks down SECURITY DEFINER RPCs)
```

**GitHub repository secrets**

```text
RASTROAYUDA_ZAVU_API_KEY, AIDTRACE_CENTER_NOTIFY_CHAT   (relayer balance alert)
AIDTRACE_QUEUE_WORKER_TOKEN                             (queue worker, same as Vercel)
AIDTRACE_APP_URL=https://aidtrace-rastroayuda.vercel.app (repository variable)
```

**Runbooks**: `scripts/relayer-rotation.md` (key rotation/emergency), `scripts/webhook-token-setup.md` (webhook hardening), `AUDIT_BLOCKS.md` (security readiness and pending tasks).

**Deployed smoke check**

```powershell
.\scripts\final-demo-check.ps1 -BaseUrl "https://aidtrace-rastroayuda.vercel.app" -Origin "https://aidtrace-rastroayuda.vercel.app"
```

## Security & Privacy

- Public: contribution status, proof timestamps, audit links, evidence count.
- Private: emails, IPs, internal signals, moderation notes.
- Never expose personal information on-chain — Celo stores only the proof hash and audit memo.

## Contributing

1. Create a descriptive branch from `main`.
2. Keep each change focused; add tests when applicable.
3. Run `npm.cmd run test` and `npm.cmd run check`.
4. Open a pull request explaining the problem, the solution, and how it was validated.

---

<p align="center">
  Built on <strong>Celo Mainnet</strong> · AidTrace | RastroAyuda for https://build4latam.com/en/p/aidtrace
</p>
