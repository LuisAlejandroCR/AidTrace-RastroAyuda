import assert from "node:assert/strict";
import test from "node:test";
import { parseAidTraceText } from "../lib/aidtrace-parser.mjs";

test("parses compact Spanish CELO alias and keeps quantity in details", () => {
  assert.deepEqual(
    parseAidTraceText("CELO1 depositar 100 aguas refugio mayor"),
    {
      actionType: "DELIVER",
      batchId: "AT-CELO-1",
      details: "100 aguas refugio mayor",
      alias: "CELO1",
    },
  );
});

test("parses spaced Spanish lot alias", () => {
  assert.deepEqual(
    parseAidTraceText("LOTE 15 entregar 3 cajas refugio este"),
    {
      actionType: "DELIVER",
      batchId: "AT-CELO-15",
      details: "3 cajas refugio este",
      alias: "LOTE 15",
    },
  );
});

test("parses explicit AidTrace batch id", () => {
  assert.deepEqual(
    parseAidTraceText("AT-CELO-9 revisar faltan 2 cajas"),
    {
      actionType: "REVIEW",
      batchId: "AT-CELO-9",
      details: "faltan 2 cajas",
      alias: undefined,
    },
  );
});

test("parses English pickup action with command prefix", () => {
  assert.deepEqual(
    parseAidTraceText("AT BATCH 8 pickup 12 medicine kits warehouse"),
    {
      actionType: "PICKUP",
      batchId: "AT-CELO-8",
      details: "12 medicine kits warehouse",
      alias: "BATCH 8",
    },
  );
});

test("normalizes accents in action words", () => {
  assert.equal(
    parseAidTraceText("CELO2 deposito 4 cajas centro").actionType,
    "DELIVER",
  );
});

test("rejects messages without a batch key", () => {
  assert.throws(
    () => parseAidTraceText("depositar 100 aguas refugio mayor"),
    /Formato no reconocido/,
  );
});

test("rejects help requests as non-recording commands", () => {
  assert.throws(
    () => parseAidTraceText("ayuda"),
    /Formato no reconocido/,
  );
});
