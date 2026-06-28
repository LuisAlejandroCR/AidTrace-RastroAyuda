import Zavudev from "@zavudev/sdk";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadDotEnv() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(scriptDir, "..", ".env"),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "").trim();
    }
  }
}

loadDotEnv();

const apiKey = process.env.RASTROAYUDA_ZAVU_API_KEY;
const to = process.argv[2];
const channel = process.argv[3] || process.env.ZAVU_CHANNEL || "telegram";
const text = process.argv.slice(4).join(" ") || "AidTrace test from Zavu.";
const looksLikePhoneNumber = /^\+\d{8,15}$/.test(to || "");

if (!apiKey) {
  throw new Error("Set RASTROAYUDA_ZAVU_API_KEY before running this script.");
}

const keyPreview = `${apiKey.slice(0, 12)}...len=${apiKey.length}`;

if (apiKey.includes("...")) {
  throw new Error(`RASTROAYUDA_ZAVU_API_KEY contains literal "...": ${keyPreview}. Copy the full unmasked key from Zavu, not the shortened dashboard preview.`);
}

if (!/^zv_(live|test)_[A-Za-z0-9_-]+$/.test(apiKey)) {
  throw new Error(`RASTROAYUDA_ZAVU_API_KEY must start with zv_live_ or zv_test_ and contain only the real key characters. Saw ${keyPreview}.`);
}

if (!to) {
  throw new Error("Usage: node scripts/send-zavu-message.mjs <to> <channel> <text>");
}

const zavu = new Zavudev({ apiKey });
const idempotencyKey = `aidtrace-test-${channel}-${to}-${Buffer.from(text).toString("hex").slice(0, 24)}`;

console.log(`Using Zavu key ${keyPreview}`);

if (channel === "telegram" && looksLikePhoneNumber) {
  console.warn("Telegram recipient looks like a phone number. Use the Zavu Telegram contact/chat id after the user starts the bot, otherwise the message may stay queued.");
}

const result = await zavu.messages.send({
  to,
  channel,
  text,
  idempotencyKey,
});

console.log(JSON.stringify(result, null, 2));
