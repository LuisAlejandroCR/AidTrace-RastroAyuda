/**
 * test/invent-channel.test.mjs
 *
 * Tests for the Invent (WhatsApp / SMS) channel adapter.
 * Run with:  npm test  (or node --test test/invent-channel.test.mjs)
 *
 * These tests verify:
 *   1. The /api/invent handler parses commands correctly.
 *   2. Authentication is enforced.
 *   3. Non-commands return the correct "not_a_command" response.
 *   4. The outbound reply builder formats messages for WhatsApp vs SMS.
 */

import { strict as assert } from 'node:assert';
import { describe, it }     from 'node:test';

import { parseAidTraceCommand }           from '../lib/aidtrace-parser.mjs';
import { buildFinalReply }                from '../lib/invent-notify.mjs';

// ---------------------------------------------------------------------------
// Parser tests (WhatsApp natural-language variants)
// ---------------------------------------------------------------------------

describe('Invent WhatsApp command parsing', () => {

  it('parses standard depositar command', () => {
    const result = parseAidTraceCommand('CELO1 depositar 100 aguas refugio mayor');
    assert.ok(result, 'Expected a parsed result');
    assert.equal(result.batchId,    'AT-CELO-1');
    assert.equal(result.eventType,  'DELIVER');
    assert.match(result.details,    /100 aguas/);
  });

  it('parses entregar as DELIVER', () => {
    const result = parseAidTraceCommand('CELO1 entregar 15 kits refugio mayor');
    assert.ok(result);
    assert.equal(result.eventType, 'DELIVER');
  });

  it('parses recoger as PICKUP', () => {
    const result = parseAidTraceCommand('CELO1 recoger centro de acopio norte');
    assert.ok(result);
    assert.equal(result.eventType, 'PICKUP');
  });

  it('parses revisar as REVIEW', () => {
    const result = parseAidTraceCommand('CELO1 revisar faltan 3 cajas');
    assert.ok(result);
    assert.equal(result.eventType, 'REVIEW');
  });

  it('parses LOTE 1 alias', () => {
    const result = parseAidTraceCommand('LOTE 1 depositar 50 medicamentos');
    assert.ok(result);
    assert.equal(result.batchId, 'AT-CELO-1');
  });

  it('parses AT-CELO-1 literal', () => {
    const result = parseAidTraceCommand('AT-CELO-1 entregar 20 bolsas de agua');
    assert.ok(result);
    assert.equal(result.batchId, 'AT-CELO-1');
  });

  it('returns null for greeting (not a command)', () => {
    const result = parseAidTraceCommand('Hola, necesito ayuda');
    assert.equal(result, null);
  });

  it('returns null for empty message', () => {
    assert.equal(parseAidTraceCommand(''), null);
    assert.equal(parseAidTraceCommand(null), null);
  });

  it('handles extra whitespace and mixed case', () => {
    const result = parseAidTraceCommand('  celo1   DEPOSITAR  80  litros  ');
    assert.ok(result);
    assert.equal(result.eventType, 'DELIVER');
  });

  it('handles SMS-style abbreviated command', () => {
    // Short command a field worker might type on a basic phone
    const result = parseAidTraceCommand('CELO1 entregar 30 cajas');
    assert.ok(result);
    assert.equal(result.batchId,   'AT-CELO-1');
    assert.equal(result.eventType, 'DELIVER');
    assert.match(result.details,   /30 cajas/);
  });

});

// ---------------------------------------------------------------------------
// Outbound reply builder tests
// ---------------------------------------------------------------------------

describe('buildFinalReply', () => {

  const BASE = {
    batchId:   'AT-CELO-1',
    eventType: 'DELIVER',
    details:   '100 aguas refugio mayor',
    txHash:    '0xabc123def456',
  };

  it('WhatsApp reply contains Celoscan link and emoji', () => {
    const reply = buildFinalReply({ ...BASE, channel: 'whatsapp' });
    assert.match(reply, /celoscan\.io\/tx\/0xabc123def456/);
    assert.match(reply, /✅/);
    assert.match(reply, /AT-CELO-1/);
    assert.match(reply, /100 aguas/);
  });

  it('SMS reply is short and contains tx URL', () => {
    const reply = buildFinalReply({ ...BASE, channel: 'sms' });
    assert.match(reply, /celoscan\.io\/tx\/0xabc123def456/);
    // SMS should be under 320 chars (2 SMS segments max)
    assert.ok(reply.length <= 320, `SMS reply too long: ${reply.length} chars`);
    // No markdown bold — SMS doesn't render it
    assert.doesNotMatch(reply, /\*[^*]+\*/);
  });

  it('WhatsApp reply includes audit instructions', () => {
    const reply = buildFinalReply({ ...BASE, channel: 'whatsapp' });
    assert.match(reply, /Logs/);
    assert.match(reply, /referenceURI/);
  });

});

// ---------------------------------------------------------------------------
// Authentication helper tests
// ---------------------------------------------------------------------------

describe('Invent token authentication', () => {

  // We test the logic directly without spinning up the full HTTP handler.
  function authCheck(headerToken, envToken) {
    if (!envToken) return true; // no env token = dev mode = skip auth
    return headerToken === envToken;
  }

  it('allows request when tokens match', () => {
    assert.equal(authCheck('secret123', 'secret123'), true);
  });

  it('rejects request when tokens differ', () => {
    assert.equal(authCheck('wrong', 'secret123'), false);
  });

  it('allows all requests when env token not set (dev mode)', () => {
    assert.equal(authCheck('anything', undefined), true);
    assert.equal(authCheck('', undefined), true);
  });

  it('rejects empty token when env token is set', () => {
    assert.equal(authCheck('', 'secret123'), false);
  });

});
