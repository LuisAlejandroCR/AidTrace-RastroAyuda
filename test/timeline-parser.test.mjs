import assert from "node:assert/strict";
import test from "node:test";
import { bytes32ToText, parseReferenceURI } from "../api/timeline-parser.mjs";

test("decodes zero-padded bytes32 text", () => {
  assert.equal(
    bytes32ToText("0x41542d43454c4f2d310000000000000000000000000000000000000000000000"),
    "AT-CELO-1",
  );
});

test("returns empty string for empty bytes32", () => {
  assert.equal(
    bytes32ToText("0x0000000000000000000000000000000000000000000000000000000000000000"),
    "",
  );
});

test("parses AidTrace referenceURI into source summary and details", () => {
  assert.deepEqual(
    parseReferenceURI("zavu:jx123 | DELIVER AT-CELO-1 | 100 aguas refugio mayor"),
    {
      source: "zavu:jx123",
      summary: "DELIVER AT-CELO-1",
      details: "100 aguas refugio mayor",
    },
  );
});

test("preserves extra separators inside details", () => {
  assert.deepEqual(
    parseReferenceURI("browser:abc | REVIEW AT-CELO-2 | faltan 3 cajas | revisar manana"),
    {
      source: "browser:abc",
      summary: "REVIEW AT-CELO-2",
      details: "faltan 3 cajas | revisar manana",
    },
  );
});
