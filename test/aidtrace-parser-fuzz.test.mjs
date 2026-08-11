import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAidTraceText,
  parseAidTraceCommand,
  normalizeCommandPart,
  aliasToBatchId,
} from "../lib/aidtrace-parser.mjs";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIONS = ["depositar", "entregar", "recoger", "revisar", "deliver", "pickup", "reporte", "DEPOSITO", "Recibido"];
const ALIASES = ["CELO1", "CELO 1", "LOTE 12", "LOTE-7", "BATCH 99", "celo42", "AT-CELO-1", "AT-XYZ_9", "aidtrace at-abc-1"];
const DETAIL_WORDS = ["aguas", "kits", "refugio", "mayor", "centro", "de", "acopio", "norte", "123", "faltan", "3", "cajas", "racion", "#42"];
const JUNK = ["", " ", "help", "AYUDA", "start", "hola", "hello world", "CELO1", "depositar", "!!", "CELO1 ??", "\u00e9\u00f1\u00fc", "\u{1F600}", "\ud83d\udc4d"];

function randomWord(rng, words) {
  return words[Math.floor(rng() * words.length)];
}

function randomString(rng, maxLen) {
  const length = Math.floor(rng() * (maxLen + 1));
  const alphabet = "abcdefghijklmnopqrstuvwxyz\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1ABC123 -#./_";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

function randomValidCommand(rng) {
  const action = randomWord(rng, ACTIONS);
  const alias = randomWord(rng, ALIASES);
  const wordCount = 1 + Math.floor(rng() * 6);
  const details = Array.from({ length: wordCount }, () => randomWord(rng, DETAIL_WORDS)).join(" ");
  return `${alias} ${action} ${details}`;
}

test("fuzz: parseAidTraceCommand never throws and returns bounded, typed results", () => {
  const rng = mulberry32(0xc01d);
  for (let i = 0; i < 1000; i += 1) {
    const input = randomString(rng, 200);
    let result;
    assert.doesNotThrow(() => {
      result = parseAidTraceCommand(input);
    }, `unexpected throw for input: ${JSON.stringify(input)}`);

    if (result) {
      assert.ok(["PICKUP", "DELIVER", "REVIEW"].includes(result.eventType), `bad actionType for ${JSON.stringify(input)}`);
      assert.match(result.batchId, /^AT-[A-Z0-9-_]+$/i, `bad batchId for ${JSON.stringify(input)}`);
      assert.ok(result.batchId.length <= 40, "batchId bounded");
      assert.ok(typeof result.details === "string" && result.details.length <= input.length + 8, "details bounded by input");
    }
  }
});

test("fuzz: valid command templates parse to consistent fields", () => {
  const rng = mulberry32(0xf00d);
  for (let i = 0; i < 1000; i += 1) {
    const input = randomValidCommand(rng);
    const parsed = parseAidTraceText(input);
    assert.ok(["PICKUP", "DELIVER", "REVIEW"].includes(parsed.actionType), `input: ${JSON.stringify(input)}`);
    assert.match(parsed.batchId, /^AT-[A-Z0-9-_]+$/i, `input: ${JSON.stringify(input)} -> ${parsed.batchId}`);
    assert.ok(parsed.details.length >= 0);
    assert.equal(typeof parsed.details, "string");
    assert.ok(!parsed.batchId.includes(" "), "batchId has no spaces");
  }
});

test("fuzz: parseAidTraceText either returns a record or throws the usage message", () => {
  const rng = mulberry32(0xbeef);
  for (let i = 0; i < 500; i += 1) {
    const input = randomString(rng, 120);
    try {
      const parsed = parseAidTraceText(input);
      assert.ok(parsed.actionType && parsed.batchId, `unexpected partial result for ${JSON.stringify(input)}`);
    } catch (error) {
      assert.match(String(error.message), /Formato no reconocido/, `wrong error for ${JSON.stringify(input)}`);
    }
  }
});

test("fuzz: normalizeCommandPart and aliasToBatchId are total functions", () => {
  const rng = mulberry32(0x5eed);
  for (let i = 0; i < 1000; i += 1) {
    const value = randomString(rng, 60);
    let normalized;
    assert.doesNotThrow(() => {
      normalized = normalizeCommandPart(value);
    });
    assert.equal(typeof normalized, "string");
    assert.doesNotThrow(() => aliasToBatchId(value, randomString(rng, 20), "AT-CELO"));
  }
});

test("fuzz: junk inputs never yield a record", () => {
  const rng = mulberry32(0xdead);
  for (let i = 0; i < 300; i += 1) {
    const input = randomWord(rng, JUNK) + randomString(rng, 30);
    const looksLikeCommand = /depositar|entregar|recoger|revisar|deliver|pickup|reporte|recibido|retiro|AT-|CELO|LOTE|BATCH/i.test(input);
    if (looksLikeCommand) continue;
    const result = parseAidTraceCommand(input);
    assert.equal(result, null, `junk parsed: ${JSON.stringify(input)} -> ${JSON.stringify(result)}`);
  }
});
