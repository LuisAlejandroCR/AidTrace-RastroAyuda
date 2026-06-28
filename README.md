# AidTrace | RastroAyuda

Offline-first custody tracking for humanitarian supplies, anchored on Celo and reachable through browser and Telegram today. SMS and WhatsApp are future channel adapters.

## Audit A Transaction

Open the Celoscan link from the bot reply, go to `Logs`, and scroll down until `data` / `referenceURI`. The `referenceURI` value contains the public audit memo, for example:

```text
zavu:<message_id> | DELIVER AT-CELO-1 | 100 aguas refugio mayor
```

`dataHash` is the private proof of the full normalized record; `referenceURI` is the human-readable audit summary.

## Current Architecture

- Static PWA: creates QR labels, records custody events, stores pending events locally, and posts relay packets when online.
- Service worker: keeps queued relay packets for automatic background sync where the browser supports it.
- Zavu Function or backend relayer: receives browser sync and inbound Telegram messages, validates events, and writes proof hashes plus public audit memos to Celo.
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

AidTraceLedger:

```text
Contract: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934
Deploy tx: 0xffff51135fb18030c1cc3f9fbfddfdbb1b0540c77c6824b9a9c1f7d163e908c2
```

## Block 1: Deploy Contract

Done on Celo Mainnet.

```text
Contract: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934
Deploy tx: 0xffff51135fb18030c1cc3f9fbfddfdbb1b0540c77c6824b9a9c1f7d163e908c2
Admin: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

Redeploy only if the contract must change. For a fresh deployment, use:

```powershell
$env:RastroAyuda_Admin_PRIVATE_KEY = "0x..."
.\scripts\deploy-contract.ps1
```

The deploy script must broadcast the transaction. If Foundry prints `Dry run enabled, not broadcasting transaction`, your local script is missing `--broadcast`; pull the latest script and rerun the block above.

The script deploys:

```text
AidTraceLedger.sol:AidTraceLedger
constructor argument: 0x326F24884FAFA1810034F4F6Dd41d280fB500569
```

After deploy:

1. Copy the deployed contract address.
2. Set `CONTRACT_ADDRESS` in `app.js`.
3. Add the relayer wallet as submitter if it is different from the admin wallet.

```powershell
cast send <CONTRACT_ADDRESS> `
  "setSubmitter(address,bool)" <RELAYER_ADDRESS> true `
  --rpc-url https://forno.celo.org `
  --private-key $env:RastroAyuda_Admin_PRIVATE_KEY
```

## Block 2: Configure Browser App

Done for the deployed contract:

```js
const CONTRACT_ADDRESS = "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";
const RELAY_ENDPOINT = "";        // Fill after Zavu Function or backend is deployed.
```

If `RELAY_ENDPOINT` is empty, events remain local and the app can demo QR creation, labels, timeline, offline warnings, and queued states. Auto-sync starts only after a relay endpoint exists.

## Block 3: Verify Contract

Done. Celoscan generated matching bytecode and ABI:

```text
https://celoscan.io/address/0xaf5c40e82ac9255479a1f447e81992b71c4f4934#code
```

Verification settings used:

```text
Contract address: 0xaf5c40e82ac9255479a1f447e81992b71c4f4934
Compiler type: Solidity (Single file)
Compiler version: v0.8.24+commit.e11b9ed9
Open source license: MIT
Contract name: AidTraceLedger
Optimization: No
EVM version: cancun
Constructor argument:
000000000000000000000000326f24884fafa1810034f4f6dd41d280fb500569
```

Paste the full contents of `AidTraceLedger.sol` as the source code. Leave libraries empty.

If using Foundry verification instead of the UI:

```powershell
$constructorArgs = cast abi-encode "constructor(address)" 0x326F24884FAFA1810034F4F6Dd41d280fB500569
forge verify-contract `
  --chain-id 42220 `
  --verifier blockscout `
  --verifier-url https://celo.blockscout.com/api/ `
  --constructor-args $constructorArgs `
  0xaf5c40e82ac9255479a1f447e81992b71c4f4934 `
  AidTraceLedger.sol:AidTraceLedger
```

On Windows, if Foundry fails with `cannot resolve file`, use the Blockscout UI values above. The contract and constructor settings are already exact.

Blockscout reference:

```text
https://celo.blockscout.com/address/0xaf5c40e82ac9255479a1f447e81992b71c4f4934
```

## Block 4: Choose Zavu Channels

Use Zavu with Telegram-first for the hackathon. Treat SMS and WhatsApp Business as future development once a local two-way number and WhatsApp sender are available.

Current channel policy:

```text
Live demo and field reports: telegram
Browser fallback: offline-first PWA queue
Future disaster fallback: sms with local two-way number
Future operator flow: whatsapp_business through Zavu
```

Do not use `sms_oneway` for QR custody updates or disaster field reports. One-way SMS is useful for alerts, but AidTrace needs inbound messages from operators, so the sender must support normal two-way SMS.

Do not migrate to Telegram-only. Telegram is useful because it has no per-message delivery fees, but it still needs mobile data and a Telegram account. In a disaster, SMS remains the lowest-connectivity fallback.

For WhatsApp, use WhatsApp Business through Zavu. Do not rely on a personal WhatsApp account. WhatsApp Business gives the project an approved sender, templates for outbound messages, and the 24-hour support window after a user messages AidTrace.

For the current deployed demo, keep confirmations on the same inbound channel. Add `channel: "auto"` later when SMS/WhatsApp are funded and verified.

## Block 5: Fund Zavu Channels

Zavu channel costs are separate from Celo relayer costs.

Use this split:

```text
Celo USDC funding wallet: on-chain relayer network fees
Zavu credits/card: SMS, voice, WhatsApp/provider messaging costs
```

The screenshot shows Telegram has no per-message delivery fees, while SMS & Voice are pay-as-you-go with `$10.00` available.

Hackathon funding order:

1. Use Telegram for coordinator/operator testing and repeated demo messages.
2. Keep the `$10.00` Zavu balance untouched unless a local two-way SMS test is required.
3. Flag WhatsApp Business as future development.
4. Keep confirmations on Telegram for the live demo.
5. Keep Celo USDC in the funding wallet for the relayer wallet only.

With only `$10.00` and no international SMS path, do not make SMS part of the live demo.

If Zavu includes a free phone number but the UI will not attach it to two-way SMS, do not buy a new `$5` number yet. Keep the free number for account setup or outbound/sandbox tests, and run the demo with Telegram as the inbound channel. Buy a two-way SMS-capable number only after Telegram and the relayer are working end-to-end.

Do not ask donors to pay Zavu directly with stablecoins. If donors send Celo USDC to the funding wallet for communications, treat it as project treasury reimbursement; the operator still pays Zavu through the dashboard.

## Block 6: Setup Zavu

Create a Zavu sender in [dashboard.zavu.dev](https://dashboard.zavu.dev/) with Telegram for the current demo. Add SMS only when a local two-way number can receive messages from target users; add WhatsApp Business after sender approval.

Decision for the current setup:

```text
Telegram: active, use now
Free number: keep, do not delete
SMS: future development, requires local two-way reachability
WhatsApp Business: future development, requires sender setup/approval
```

The repo includes starter source in `zavu/aidtrace-relayer`. Create the Zavu Function workspace, then copy the starter source into it:

Fast path with the repo script:

```powershell
zavu login
$env:RASTROAYUDA_RELAYER_PRIVATE_KEY = "0x..."
.\scripts\setup-zavu-relayer.ps1 -SenderId <zavu_sender_id> -AppBaseUrl <deployed_app_url>
```

The script creates the working Zavu Function under `work/zavu/aidtrace-relayer`, which is ignored by git.

Manual path:

```bash
zavu login
zavu fn init aidtrace-relayer --template blank
cp -R zavu/aidtrace-relayer/* aidtrace-relayer/
cd aidtrace-relayer
```

Set secrets:

```bash
zavu fn secrets set SENDER_ID <zavu_sender_id>
zavu fn secrets set PRIMARY_CHANNEL telegram
zavu fn secrets set FALLBACK_CHANNEL sms
zavu fn secrets set ENABLE_SMS_FALLBACK false
zavu fn secrets set CELO_RPC_URL https://forno.celo.org
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

## Block 7: Test Zavu Outbound

Install the SDK once in the repo:

```powershell
npm install @zavudev/sdk
```

Set the API key:

```powershell
$env:RASTROAYUDA_ZAVU_API_KEY = "zv_live_or_test_real_key"
```

Or put it in `.env`:

```text
RASTROAYUDA_ZAVU_API_KEY=zv_live_or_test_real_key
```

The key must start with `zv_live_` or `zv_test_`. `zv_...` and values containing literal `...` are dashboard-shortened placeholders and will fail with `Invalid API key format`; copy the full secret value from Zavu.

Optional outbound-only SMS test, future development:

```powershell
node .\scripts\send-zavu-message.mjs +14706970482 sms "AidTrace SMS test"
```

Send a Telegram test after the receiving user has started the bot:

```powershell
node .\scripts\send-zavu-message.mjs <telegram_contact_or_chat_id> telegram "AidTrace Telegram test"
```

`@AidTrace_Bot` is the bot/sender identity, not the recipient. For Telegram delivery, use the Telegram contact/chat identifier Zavu shows after a user starts the bot or sends the first message.

These scripts only test outbound delivery. They do not replace the relayer. The relayer still needs the `message.inbound` trigger so incoming Telegram commands can be parsed and written to Celo. SMS inbound remains future development until a reachable two-way number is available.

## Block 8: Delivery Debug

`queued` means Zavu accepted the message. It does not mean the carrier or Telegram delivered it.

Current test ids:

```text
SMS: jx7f1zqbt906d1x3frw8a1dhgx89ffym
Telegram: jx7ase54jc2jqgxzp72gbtazvh89fe0a
```

Check these in Zavu Monitoring before sending more SMS. If a message stays `queued` for more than 5-10 minutes, debug the sender route before spending more balance.

Do not keep testing Telegram with a phone number unless Zavu already mapped that phone to a Telegram contact. Telegram delivery should use the Zavu Telegram contact/chat id created after the user starts `@AidTrace_Bot` or sends the bot a first message.

Fastest low-cost test:

```text
1. Open Telegram as the field user.
2. Start @AidTrace_Bot.
3. Send: CELO1 depositar 20 water boxes refugio
4. Confirm the inbound message appears in Zavu Inbox or Monitoring.
5. Use that contact/chat id for any outbound Telegram confirmation test.
```

Pause SMS tests for the hackathon. International SMS is not required for the live demo and can consume balance without proving inbound reachability.

## Block 9: Zavu Message Contract

Inbound Telegram should be text-only and natural. Future Voice-notes, SMS/WhatsApp adapters should use the same grammar. Print the short key on the QR label and let operators write quantity in the details:

```text
CELO7 depositar 100 aguas refugio mayor
LOTE 7 entregar 15 kits refugio mayor
AT-CELO-7 recoger centro de acopio norte
AT-CELO-7 revisar faltan 3 cajas
```

`CELO7` / `LOTE 7` is the batch key and maps to `AT-CELO-7`. Numbers inside the rest of the sentence are treated as details, not as the batch number.

Relayer behavior:

1. Parse command and batch id.
2. Normalize to the same event schema used by the PWA.
3. Hash the normalized event.
4. Call `recordAction(batchId, actionType, dataHash, sender, referenceURI)`.
5. Put a short public audit memo in `referenceURI` so explorers show what happened without exposing the full normalized payload.
6. Reply through Zavu with a short confirmation and full Celoscan transaction link.

Reply format:

```text
Registrado en Celo: DELIVER AT-CELO-1
Detalles: 100 aguas refugio mayor
Tx: https://celoscan.io/tx/<tx_hash>
Auditoria: abre el link, ve a Logs y baja hasta data / referenceURI.
```

Use Zavu `idempotencyKey` from inbound `messageId + batchId + actionType` to avoid duplicate confirmations. Use the inbound phone number as the off-chain sender identity; do not put personal phone numbers directly on-chain.

### Celo Write Queue / Lock

Telegram can deliver several offline messages at once. Because all on-chain writes use the same relayer wallet, the webhook must serialize Celo transactions or the relayer can hit nonce races such as `replacement transaction underpriced`.

The deployed `api/zavu.mjs` supports a distributed Supabase Postgres lock. It still has an in-memory queue for local dev, but production should set the Supabase env vars so parallel Vercel instances share the same lock.

Create the lock table in Supabase SQL Editor:

```sql
create table if not exists public.aidtrace_locks (
  lock_key text primary key,
  lock_value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.aidtrace_locks enable row level security;
```

Create the lock RPC functions in the same SQL Editor tab:

```sql
create or replace function public.try_acquire_aidtrace_lock(
  p_lock_key text,
  p_lock_value text,
  p_ttl_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.aidtrace_locks
  where lock_key = p_lock_key
    and expires_at < now();

  insert into public.aidtrace_locks(lock_key, lock_value, expires_at)
  values (
    p_lock_key,
    p_lock_value,
    now() + ((p_ttl_ms || ' milliseconds')::interval)
  )
  on conflict do nothing;

  return exists (
    select 1
    from public.aidtrace_locks
    where lock_key = p_lock_key
      and lock_value = p_lock_value
  );
end;
$$;

create or replace function public.release_aidtrace_lock(
  p_lock_key text,
  p_lock_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.aidtrace_locks
  where lock_key = p_lock_key
    and lock_value = p_lock_value;
end;
$$;

grant execute on function public.try_acquire_aidtrace_lock(text, text, integer) to anon, authenticated, service_role;
grant execute on function public.release_aidtrace_lock(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
```

If Vercel logs show `new row violates row-level security policy`, the direct-table lock path is being blocked. Use the RPC functions above and redeploy with the latest `api/zavu.mjs`.

If Vercel logs show `Could not find the function public.try_acquire_aidtrace_lock(...) in the schema cache`, run the SQL block again and keep the final `notify pgrst, 'reload schema';` line. Supabase can take a moment to expose new RPC functions through PostgREST.

Use the server-only service role key from Supabase. Do not expose it in browser code.

Vercel env vars:

```text
SUPABASE_URL=<supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
```

Optional tuning:

```text
AIDTRACE_CELO_WRITE_GAP_MS=1800
AIDTRACE_CELO_LOCK_WAIT_MS=25000
AIDTRACE_CELO_LOCK_TTL_MS=45000
AIDTRACE_CELO_LOCK_KEY=aidtrace:celo-write-lock
AIDTRACE_SUPABASE_LOCK_ACQUIRE_RPC=try_acquire_aidtrace_lock
AIDTRACE_SUPABASE_LOCK_RELEASE_RPC=release_aidtrace_lock
```

Keep the lock TTL longer than one expected Celo write plus confirmation wait. If the function crashes, the lock expires automatically.

Redis fallback remains supported if these env vars exist instead:

```text
UPSTASH_REDIS_REST_URL=<upstash_rest_url>
UPSTASH_REDIS_REST_TOKEN=<upstash_rest_token>
```

## Block 10: Test Path

Run this order:

1. Create QR in the browser.
2. Save/print the label.
3. Open the QR URL on mobile and add a custody event.
4. Switch offline, add another event, and confirm it queues without user action.
5. Restore internet and confirm automatic sync toast.
6. Send a Telegram command to the Zavu bot: `CELO1 depositar 100 aguas refugio mayor`.
7. Confirm the Telegram reply includes a Celo transaction hash.
8. Open the transaction in Celoscan or Blockscout and confirm the `referenceURI` contains the public audit memo.
9. Confirm the Celo event exists for the batch id.

Useful checks:

```bash
zavu fn invoke --event message.inbound --data '{"from":"telegram-demo","text":"CELO1 depositar 100 aguas refugio mayor","messageId":"local-test-1","channel":"telegram"}'
zavu fn logs --tail
cast logs --address <CONTRACT_ADDRESS> --rpc-url https://forno.celo.org
```

Expected public memo shape in the transaction input:

```text
zavu:<message_id> | DELIVER AT-CELO-1 | 100 aguas refugio mayor
```

## Payment Notes

Donors can send Celo USDC to the funding wallet for relayer fee support. Zavu credits are separate; fund Zavu through the dashboard and reconcile donor stablecoins as treasury support if needed.

Field users should not connect a wallet, hold CELO, or pay fees. The relayer owns network fee payment.
