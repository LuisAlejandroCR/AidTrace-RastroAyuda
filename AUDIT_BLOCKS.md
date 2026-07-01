# AidTrace Audit Blocks

Use these blocks to audit security and production readiness changes. Each block is scoped so it can be reviewed independently before the next one starts.

## Audit Priority

```text
P0: protect relayer spend and prevent forged writes
P1: keep timeline fast and bounded as on-chain events grow
P1: preserve operational recovery for relayer keys
P2: add basic regression coverage and CI
P2: complete PWA installability assets
```

## Block 1 - Relay Authentication And Abuse Control

Status:

```text
PASSED FOR BROWSER RELAY - implemented origin allowlist, browser relay payload validation, packet-size limit, duplicate detection inside one packet, generic browser relay errors, optional webhook token support, durable idempotency, and per-IP/per-batch rate limit.
Remaining - Zavu webhook token is still pending operator setup.
```

Risk:

```text
/api/zavu accepts browser relay packets and Zavu inbound events. With wildcard CORS and no request authentication, any caller can try to submit events through the relayer wallet.
```

Current files:

```text
api/zavu.mjs
app.js
sw.js
```

Required changes:

```text
1. Split webhook traffic from browser relay traffic, or enforce separate auth rules per traffic type. DONE in api/zavu.mjs.
2. Zavu webhook path: require a shared webhook secret or Zavu signature header before processing message.inbound. PARTIAL via optional AIDTRACE_WEBHOOK_TOKEN; current Zavu webhook cannot attach custom headers.
3. Browser relay path: add abuse controls because a static browser cannot safely hold a secret. PASSED via origin allowlist, payload validation, persistent idempotency, and Supabase rate limit guard.
   Minimum demo control: strict origin allowlist + payload validation + per-IP/per-batch rate limit. PASSED.
   Stronger control: queue first, approve/process server-side, then write to Celo.
4. Add idempotency keys for browser packets so resubmits do not create duplicate on-chain writes.
5. Return generic errors to callers; log detailed errors server-side only. DONE for browser relay item failures.
```

Acceptance checks:

```text
curl -X POST https://<app>/api/zavu -H "Content-Type: application/json" -d "{}"
# Expected: 400 unsupported event. No Celo transaction.

curl -X POST https://<app>/api/zavu -H "Origin: https://evil.example" -H "Content-Type: application/json" -d "{\"schema\":\"aidtrace.relay.v1\",\"pending\":[]}"
# Expected: rejected by origin/auth/rate policy.

Submit the same browser packet twice.
# Expected: one Celo write or one accepted queue row, not two duplicate txs.
```

Reviewer notes:

```text
Do not put a permanent secret in app.js. Static PWA code is public.
For Zavu, prefer a webhook secret/signature check if available in the dashboard. If not available, use a random endpoint path plus an AIDTRACE_WEBHOOK_TOKEN header as a temporary hackathon control.
```

## Block 2 - Celo Write Queue

Risk:

```text
Concurrent Telegram/browser events can collide at the relayer account nonce or hit replacement transaction underpriced errors. The current lock reduces collision risk but does not persist queued work if the serverless function exits.
```

Current files:

```text
api/zavu.mjs
api/process-queue.mjs
README.md
Supabase project SQL editor
supabase/aidtrace_queue.sql
```

Required changes:

```text
1. Move inbound work into a Supabase queue table before writing to Celo. SQL READY in supabase/aidtrace_queue.sql.
2. Make inbound_message_id unique. SQL READY in supabase/aidtrace_queue.sql.
3. Process rows one at a time using claim/complete/retry RPCs. SQL READY in supabase/aidtrace_queue.sql; API wiring READY for Telegram/Zavu behind AIDTRACE_QUEUE_ENABLED.
4. Keep the existing lock as a second safety layer around the actual write.
5. Reply to Telegram in two stages when needed:
   - immediate: "Recibido, en cola"
   - final: "Registrado en Celo..." with tx link
6. Keep browser queue disabled for demo unless AIDTRACE_BROWSER_QUEUE_ENABLED is explicitly set and the UI is updated to track queued browser proofs.
```

Acceptance checks:

```text
Send three Telegram messages quickly while reconnecting.
# Expected: three queue rows, processed sequentially, no nonce/replacement errors.

Kill/redeploy the Vercel function during processing.
# Expected: pending/processing rows can be retried after lock timeout.

Duplicate Zavu delivery with same message id.
# Expected: one queue row due to unique inbound_message_id.
```

Operational SQL target:

```text
aidtrace_message_queue(id, inbound_message_id, channel, source, payload, status, attempts, next_run_at, locked_at, locked_by, last_error, tx_hash, created_at, updated_at)
```

## Block 3 - Timeline Indexing And Bounded Reads

Status:

```text
PARTIAL - Supabase timeline cache SQL and API indexing path are ready.
Remaining - run supabase/aidtrace_timeline.sql, deploy api/timeline.mjs, then verify /api/timeline?limit=30 twice.
```

Risk:

```text
/api/timeline scans from deployment block to latest block on every request. This is acceptable for a small demo but will slow down and become RPC-expensive as usage grows.
```

Current files:

```text
api/timeline.mjs
app.js
supabase/aidtrace_timeline.sql
```

Required changes:

```text
1. Store indexed events in Supabase or another durable read model. SQL READY in supabase/aidtrace_timeline.sql.
2. Track last_indexed_block per contract. SQL/API READY.
3. On refresh, fetch only new logs from last_indexed_block + 1 to latest. API READY.
4. Serve timeline from the indexed table with limit/cursor pagination. DONE; `/api/timeline` returns pagination.nextCursor when more rows exist.
5. Keep an admin-only reindex path for recovery.
```

Acceptance checks:

```text
Call /api/timeline?limit=30 twice.
# Expected: second call does not rescan all historical Celo logs.

Add a new on-chain event.
# Expected: only new block range is scanned, then event appears in timeline.

Call /api/timeline?limit=100.
# Expected: bounded response with stable ordering and no full-history payload.
```

Performance target:

```text
P95 /api/timeline under 1.5s for 1,000+ events.
No single request should scan from deployment block unless explicitly reindexing.
```

## Block 4 - Relayer Key Rotation And Blast Radius

Status:

```text
PARTIAL - rotation and emergency revocation runbook added at scripts/relayer-rotation.md.
Remaining - manual rotation drill should be done only when the operator is ready with a funded replacement relayer.
```

Risk:

```text
The relayer private key is a hot key. If it is leaked, an attacker can write fake events until the submitter is revoked on-chain.
```

Current files:

```text
api/zavu.mjs
AidTraceLedger.sol
scripts/setup-zavu-relayer.ps1
scripts/relayer-rotation.md
```

Required changes:

```text
1. Keep RastroAyuda_Admin separate from RASTROAYUDA_RELAYER_PRIVATE_KEY.
2. Fund relayer with only enough CELO/fee currency for expected demo traffic.
3. Document the rotation runbook: DONE in scripts/relayer-rotation.md.
   - create new relayer wallet
   - fund new relayer
   - admin calls setSubmitter(newRelayer, true)
   - update Vercel env
   - redeploy
   - admin calls setSubmitter(oldRelayer, false)
4. Monitor relayer balance and unexpected event volume.
```

Acceptance checks:

```text
Confirm admin address is not used as RASTROAYUDA_RELAYER_PRIVATE_KEY.
Confirm old relayer can be revoked with setSubmitter(oldRelayer, false).
Confirm app still writes after switching to new relayer key.
```

## Block 5 - CORS And Endpoint Surface

Status:

```text
READY FOR DEPLOY VERIFICATION - /api/zavu and /api/timeline both use AIDTRACE_ALLOWED_ORIGINS. Direct GET access to /api/timeline still works when no Origin header is present.
```

Risk:

```text
Access-Control-Allow-Origin: * is set on relay and timeline endpoints. Wildcard CORS is not the only protection boundary, but on write endpoints it increases abuse surface.
```

Current files:

```text
api/zavu.mjs
api/timeline.mjs
```

Required changes:

```text
1. For /api/zavu, allow only configured origins and expected headers.
2. For /api/timeline, wildcard can remain if it is read-only and rate-limited, but prefer allowlist for app demo. DONE in api/timeline.mjs.
3. Add AIDTRACE_ALLOWED_ORIGINS=https://aidtrace-rastroayuda.vercel.app,http://127.0.0.1:8017.
4. Reject unexpected methods and content types before reading body.
```

Acceptance checks:

```text
Browser app from allowed origin works.
Unknown origin cannot write to /api/zavu.
OPTIONS response returns only allowed methods/headers.
```

## Block 6 - Tests And CI

Status:

```text
READY FOR PUSH VERIFICATION - parser helpers and timeline parser helpers were extracted, Node tests were added, local npm test/check scripts are ready, and GitHub Actions workflow is present.
```

Risk:

```text
Parser, queue, relay, and timeline behavior can regress without warning. The hackathon demo depends on small edge cases: natural Spanish text, alias parsing, idempotency, and offline sync.
```

Current files:

```text
api/zavu.mjs
api/timeline.mjs
app.js
package.json
```

Required changes:

```text
1. Extract parser helpers from api/zavu.mjs into a testable module. DONE in api/aidtrace-parser.mjs.
2. Add unit tests for:
   - CELO1 / LOTE 1 / AT-CELO-1 batch parsing
   - depositar/entregar/recoger/revisar aliases
   - details extraction with numbers
   - duplicate message id handling. PARTIAL; parser behavior covered, queue idempotency covered manually.
3. Add a timeline parser test for bytes32 and referenceURI. DONE.
4. Add npm scripts:
   - npm run test
   - npm run lint or npm run check. DONE with npm run check.
5. Add GitHub Actions workflow for node install + test. DONE in .github/workflows/ci.yml.
```

Acceptance checks:

```text
npm run test
# Expected: parser and timeline tests pass locally.

Push branch to GitHub.
# Expected: CI runs and fails on broken parser behavior.
```

## Block 7 - PWA Installability

Status:

```text
CODE READY - manifest has 192x192, 512x512, and 512x512 maskable PNG icons. Service worker cache was bumped to aidtrace-v14 and now includes the icon assets.
```

Risk:

```text
manifest.webmanifest has an empty icons array. Some browsers will not offer clean install behavior or will display a generic app icon.
```

Current files:

```text
manifest.webmanifest
index.html
sw.js
```

Required changes:

```text
1. Add 192x192 and 512x512 PNG icons. DONE in assets/icons.
2. Add maskable icon if possible. DONE.
3. Include purpose fields: "any maskable" for the 512 icon. DONE.
4. Bump service worker cache after adding assets. DONE, aidtrace-v14.
```

Acceptance checks:

```text
Open browser devtools -> Application -> Manifest.
# Expected: no icon warnings.

Install app on mobile.
# Expected: AidTrace icon appears instead of generic browser icon.
```

## Block 8 - Demo Diff Review

Run this block before presenting or pushing:

```text
git status --short
git diff -- api/zavu.mjs api/timeline.mjs app.js sw.js manifest.webmanifest README.md AUDIT_BLOCKS.md supabase/aidtrace_queue.sql
npm.cmd run test
npm.cmd run check
.\scripts\final-demo-check.ps1 -SkipRemote
```

Manual demo path:

```text
1. Create QR.
2. Save QR PDF.
3. Add offline browser event.
4. Reconnect and confirm automatic sync.
5. Send Telegram: CELO1 depositar 100 aguas refugio mayor.
6. Confirm bot reply includes full Celoscan tx URL.
7. Open Timeline and confirm Celo event appears with date/time.
8. Open Celoscan Logs and verify referenceURI contains the public details.
```

## Pending Tasks To Finish

Keep this registry at the end of the audit file so review does not lose the remaining operational work. Update `Status` before every demo, deploy, or push.

```text
Execution order:
1. P0-00, P0-01, P0-06, P0-07
2. P0-02, P0-03, P0-04, P0-05
3. P1-01, P1-02, P1-03, P1-04
4. P2-01, P2-02, P2-03, P2-04, P2-05

P0-00 - Deploy current relay hardening changes
Status: passed after deploy.
Why: local code now has stricter CORS, relay validation, generic browser errors, and optional webhook token support.
Files: api/zavu.mjs, README.md, AUDIT_BLOCKS.md, test/zavu-handler.test.mjs.
Action: review diff, push to GitHub manually, and let Vercel deploy.
Acceptance: deployed /api/zavu still accepts valid browser relay from the app origin and valid Telegram webhook events.
Issue: addresses GitHub issue #1 by rejecting empty/unsupported /api/zavu POSTs, enforcing browser Origin checks before body handling, documenting webhook-token limitations, and adding relay regression tests.
Last verified locally: npm.cmd run test passed 14 tests; npm.cmd run check passed.
Last verified deployed: final-demo-check.ps1 passed.

P0-01 - AIDTRACE_WEBHOOK_TOKEN
Status: PARTIAL - header probe shows current Zavu webhook does not attach custom headers; keep env unset unless a Zavu Function/proxy is added.
Why: protects Zavu inbound webhook from unauthenticated callers.
Env: AIDTRACE_WEBHOOK_TOKEN.
Files: api/zavu.mjs, api/header-probe.mjs, scripts/webhook-token-setup.md, README.md.
Observed: /api/header-probe returned hasAidTraceHeader=false and hasBearer=false for userAgent Zavu-Webhook/1.0.
Action: do not enable AIDTRACE_WEBHOOK_TOKEN with the current Zavu webhook.
Action: keep Telegram protected by queue serialization, generic errors, Celo write lock, and existing endpoint monitoring for the demo.
Future action: add a Zavu Function/proxy that forwards inbound events to /api/zavu with X-AidTrace-Webhook-Token, then enable AIDTRACE_WEBHOOK_TOKEN.
Rollback: remove AIDTRACE_WEBHOOK_TOKEN from Vercel and redeploy if Telegram inbound returns 401.
Acceptance: Telegram message records on Celo with AIDTRACE_WEBHOOK_TOKEN unset today, or with token enabled only after a header-capable proxy is live.

P0-06 - AIDTRACE_ALLOWED_ORIGINS
Status: passed after deploy.
Why: /api/zavu now only sets CORS for allowed browser origins and rejects browser relay requests from unknown origins.
Env: AIDTRACE_ALLOWED_ORIGINS.
Required value: https://aidtrace-rastroayuda.vercel.app,http://127.0.0.1:8017,http://localhost:8017
Action: set the env in Vercel before or with the hardening deploy.
Acceptance: browser app sync works from production; unknown Origin relay request is rejected.
Last verified deployed: final-demo-check.ps1 passed timeline CORS allowlist, timeline CORS rejection, and bad-origin relay rejection.

P0-07 - Relay hardening smoke tests
Status: passed after deploy for automated smoke checks; manual browser offline and Telegram walkthrough remain part of final demo verification.
Why: confirms Block 1 did not break the demo path.
Files: api/zavu.mjs, app.js, scripts/final-demo-check.ps1, test/zavu-handler.test.mjs.
Action: submit one browser offline proof and let it sync.
Action: send one Telegram message through Zavu.
Action: send a relay request from an unknown Origin and confirm rejection.
Acceptance: valid app and Telegram paths work; unknown Origin does not write to Celo.
Local regression: empty /api/zavu POST returns 400; unknown-origin browser relay returns 403 before body handling.
Deploy note: production returned 500 for the bad-origin relay before the early-origin guard was added; final-demo-check.ps1 passed after deploy.

P0-02 - Supabase durable queue table
Status: SQL executed; worker smoke test reached Supabase.
Why: serverless memory queues are not durable; reconnect bursts can still collide or disappear.
Files: supabase/aidtrace_queue.sql, README.md, Supabase SQL editor.
Action: run supabase/aidtrace_queue.sql in Supabase SQL editor.
Action: confirm functions are available through PostgREST after notify pgrst reload.
Acceptance: enqueue_aidtrace_message returns the same queue row for duplicate inbound_message_id.

P0-03 - Queue-backed Celo worker
Status: deployed burst test passed for three queued Celo writes; GitHub cron worker added.
Why: writes must be serialized across Vercel instances and survive function exit.
Files: api/zavu.mjs, api/process-queue.mjs, .github/workflows/process-queue.yml.
Action: run supabase/aidtrace_queue.sql.
Action: set AIDTRACE_QUEUE_ENABLED=true only after SQL is live.
Action: set AIDTRACE_QUEUE_WORKER_TOKEN and call POST /api/process-queue?limit=3 with that token.
Action: add GitHub secret AIDTRACE_QUEUE_WORKER_TOKEN and let .github/workflows/process-queue.yml call the worker every 5 minutes.
Action: leave AIDTRACE_BROWSER_QUEUE_ENABLED unset for the demo; browser proofs should keep returning tx hashes directly.
Action: keep current Supabase/Redis lock around the actual Celo write.
Acceptance: PASSED - three quick Telegram messages produced three sequential Celo tx hashes without replacement transaction underpriced errors.
Last verified: POST /api/process-queue?limit=3 processed three queued rows and returned Celo tx hashes.
Follow-up verified: a second POST /api/process-queue?limit=3 returned processed=0, confirming the queue was empty after the burst.

P0-04 - Browser relay idempotency
Status: passed in deployed smoke test.
Why: static PWA retries can resend the same event.
Files: api/zavu.mjs, supabase/aidtrace_relay_guard.sql.
Action: run supabase/aidtrace_relay_guard.sql in Supabase SQL editor.
Action: set AIDTRACE_BROWSER_RELAY_GUARD_ENABLED=true only after the SQL is live.
Action: resend the same browser relay packet twice.
Acceptance: resending the same browser packet does not create duplicate Celo writes.
Last verified: duplicate browser packet returned the same txHash for id manual-dupe-ecbfd359-8391-4d51-b55b-67b1ade903b6.

P0-05 - Browser relay rate limit
Status: passed in deployed smoke test.
Why: origin allowlists do not stop server-side callers from spending relayer funds.
Files: api/zavu.mjs, supabase/aidtrace_relay_guard.sql.
Env: AIDTRACE_BROWSER_RELAY_GUARD_ENABLED=true, AIDTRACE_BROWSER_RELAY_RATE_LIMIT=30.
Action: run supabase/aidtrace_relay_guard.sql in Supabase SQL editor.
Action: set AIDTRACE_BROWSER_RELAY_RATE_LIMIT to the desired per-IP/per-batch per-minute limit.
Action: submit more than the configured limit for the same batch within one minute.
Acceptance: repeated abusive relay requests are rejected before Celo writes.
Last verified: browser relay returned "Relay rate limit exceeded" for id manual-rate-a8866522-7474-4108-96ad-4bbfed9e961b before recording.

P1-01 - Timeline index table
Status: passed after deploy.
Why: /api/timeline currently scans historical logs from deployment block.
Files: api/timeline.mjs, supabase/aidtrace_timeline.sql, Supabase SQL editor.
Action: cache contract logs into Supabase.
Action: track last_indexed_block per contract.
Acceptance: /api/timeline does not rescan from deployment block on every request.
Last verified deployed: /api/timeline?limit=30 returned indexed=true with index.lastIndexedBlock matching latestBlock.

P1-02 - Timeline pagination from indexed data
Status: passed after deploy.
Why: timeline should stay fast after hundreds or thousands of events.
Files: api/timeline.mjs, app.js.
Action: serve timeline from indexed table with limit/cursor. DONE in api/timeline.mjs.
Action: deploy and call /api/timeline?limit=30; if pagination.nextCursor is present, call /api/timeline?limit=30&cursor=<nextCursor>.
Acceptance: /api/timeline?limit=30 returns bounded data under target latency.
Last verified deployed: /api/timeline?limit=30 returned pagination.nextCursor=30 and final-demo-check.ps1 verified the cursor page returns ok=true.

P1-03 - Relayer key rotation drill
Status: passed after deploy.
Why: relayer is a hot key and must be revocable.
Files: AidTraceLedger.sol, scripts/setup-zavu-relayer.ps1, scripts/relayer-rotation.md, Vercel envs.
Action: create a second relayer, grant submitter role, update Vercel, revoke old relayer.
Acceptance: app writes with the new relayer and old relayer can no longer write.
Last verified deployed: new relayer wrote Telegram queue event 0x332d57fc44b26d3cc5cfc3467126da2354a2eff3bf19b9f81d08217739a77616, follow-up Telegram proof 0x73d965e7f79cf28116ab91981694f2e2ee32942015a29a9098d104dc2cdee20c succeeded, and old relayer was revoked by operator.

P1-04 - Timeline endpoint CORS policy
Status: passed after deploy.
Why: read-only wildcard CORS is lower risk, but allowlist is cleaner for demo review.
Files: api/timeline.mjs.
Action: deploy api/timeline.mjs with AIDTRACE_ALLOWED_ORIGINS.
Action: open /api/timeline directly in the browser and confirm it still returns JSON.
Action: send OPTIONS/GET from an unknown Origin and confirm rejection.
Acceptance: reviewer can explain why timeline CORS is public or restricted.
Last verified deployed: final-demo-check.ps1 passed direct JSON, allowed Origin OPTIONS, and unknown Origin rejection.

P2-01 - Parser unit tests
Status: complete for core parser behavior.
Why: Telegram natural language parsing is core demo behavior.
Files: api/aidtrace-parser.mjs, api/zavu.mjs, test/aidtrace-parser.test.mjs, package.json.
Action: extract parser helpers from api/zavu.mjs. DONE.
Action: test CELO1, LOTE 1, AT-CELO-1, depositar, entregar, recoger, revisar. DONE.
Acceptance: parser regression fails locally.
Last verified: npm run test passed 7 parser tests.

P2-02 - Timeline parser tests
Status: complete for parser behavior.
Why: audit details depend on bytes32 and referenceURI parsing.
Files: api/timeline-parser.mjs, api/timeline.mjs, test/timeline-parser.test.mjs.
Action: test bytes32ToText and parseReferenceURI. DONE.
Acceptance: malformed or changed referenceURI behavior is caught.
Last verified: npm run test passed 11 total parser and timeline parser tests.

P2-03 - CI pipeline
Status: passed after push.
Why: no automated check protects the hackathon demo from regressions.
Files: .github/workflows/ci.yml, package.json.
Action: run npm install and npm test or node --check commands. DONE locally via npm run test and npm.cmd run check.
Action: add .github/workflows/ci.yml. DONE.
Action: push to GitHub and confirm the workflow passes. DONE.
Acceptance: GitHub Actions fails on syntax or parser regression.
Last verified deployed: GitHub Actions CI run passed on main after "Harden AidTrace relay and complete audit blocks".

P2-04 - PWA icons
Status: passed after deploy.
Why: manifest.webmanifest has an empty icons array.
Files: manifest.webmanifest, sw.js, assets/icons/icon-192.png, assets/icons/icon-512.png, assets/icons/icon-maskable-512.png.
Action: add 192x192 and 512x512 PNG icons, preferably maskable. DONE.
Action: bump service worker cache after adding icon assets. DONE.
Acceptance: browser Application > Manifest shows no icon warnings.
Last verified deployed: manifest includes 192, 512, and maskable 512 PNG icons; all icon asset URLs returned 200 OK as image/png.

P2-05 - Final demo verification
Status: automated deployed smoke passed; manual browser/Telegram walkthrough still pending.
Why: confirms the whole story still works after audit hardening.
Files: app, api/zavu.mjs, api/timeline.mjs, scripts/final-demo-check.ps1.
Action: run Block 8 Demo Diff Review. SCRIPT READY.
Action: run .\scripts\final-demo-check.ps1 -BaseUrl "https://aidtrace-rastroayuda.vercel.app" -Origin "https://aidtrace-rastroayuda.vercel.app" after deploy.
Action: manually verify browser offline path, Telegram path, Timeline, and Celoscan Logs.
Acceptance: browser offline path, Telegram path, Celo tx link, Timeline, and Celoscan Logs all pass.
Last verified deployed: final-demo-check.ps1 passed.

P2-06 - Invent WhatsApp/SMS channel adapter
Status: implementation complete; pending smoke check (scripts/invent-smoke-check.ps1).
Why: reaches field workers using WhatsApp/SMS instead of Telegram — the majority in Venezuela.
Files: api/invent.mjs, api/invent-notify.mjs, api/aidtrace-parser.mjs (parseAidTraceCommand),
       api/zavu.mjs (_processInventQueueRow dispatch), test/invent-channel.test.mjs,
       .github/workflows/ci-invent.yml, scripts/invent-setup.md, scripts/invent-smoke-check.ps1.
Env: AIDTRACE_INVENT_WEBHOOK_TOKEN, AIDTRACE_INVENT_API_KEY.
Action: follow scripts/invent-setup.md to connect WhatsApp Business in Invent and configure the HTTP action.
Action: set AIDTRACE_INVENT_WEBHOOK_TOKEN and AIDTRACE_INVENT_API_KEY in Vercel environment.
Action: run .\scripts\invent-smoke-check.ps1 -BaseUrl "https://aidtrace-rastroayuda.vercel.app" after deploy.
Acceptance: smoke check 6/6 pass; WhatsApp custody command queued → Celo tx → final reply received in chat.
```
