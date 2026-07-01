const ACTION_ALIASES = {
  PICKUP: "PICKUP",
  PICKED_UP: "PICKUP",
  RECOGER: "PICKUP",
  RECOGIDO: "PICKUP",
  RETIRO: "PICKUP",
  RECIBIR: "PICKUP",
  RECIBIDO: "PICKUP",
  DELIVER: "DELIVER",
  DELIVERED: "DELIVER",
  DELIVERY: "DELIVER",
  ENTREGAR: "DELIVER",
  ENTREGADO: "DELIVER",
  ENTREGA: "DELIVER",
  DEPOSITAR: "DELIVER",
  DEPOSITADO: "DELIVER",
  DEPOSITO: "DELIVER",
  LLEVAR: "DELIVER",
  LLEVADO: "DELIVER",
  REVIEW: "REVIEW",
  REVISAR: "REVIEW",
  REVISION: "REVIEW",
  REVISADO: "REVIEW",
  REPORTE: "REVIEW",
};

const COMMAND_PREFIXES = new Set(["AT", "AIDTRACE", "RASTROAYUDA", "RASTRO"]);
const HELP_WORDS = new Set(["HELP", "AYUDA", "START", "INICIO"]);
const ALIAS_WORDS = new Set(["CELO", "LOTE", "BATCH"]);

export function normalizeCommandPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function usageMessage() {
  return [
    "Formato no reconocido o falta la clave del lote.",
    "Ejemplo: CELO1 depositar 100 aguas refugio mayor",
    "CELO1 es la clave del lote; 100 aguas queda como detalle.",
    "Tambien: LOTE 1 entregar 15 kits refugio mayor",
    "Acciones: recoger, entregar/depositar, revisar",
  ].join("\n");
}

export function aliasToBatchId(value, nextValue = "", aliasPrefix = process.env.AIDTRACE_ALIAS_PREFIX || "AT-CELO") {
  const normalized = normalizeCommandPart(value).replace(/^#/, "");
  const compact = normalized.match(/^(CELO|LOTE|BATCH)-?#?(\d{1,6})$/);

  if (compact) {
    return { batchId: `${aliasPrefix}-${Number(compact[2])}`, width: 1 };
  }

  const nextNumber = normalizeCommandPart(nextValue).replace(/^#/, "");
  if (ALIAS_WORDS.has(normalized) && /^\d{1,6}$/.test(nextNumber)) {
    return { batchId: `${aliasPrefix}-${Number(nextNumber)}`, width: 2 };
  }

  return null;
}

export function parseAidTraceText(text, options = {}) {
  const aliasPrefix = options.aliasPrefix || process.env.AIDTRACE_ALIAS_PREFIX || "AT-CELO";
  const clean = String(text || "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    throw new Error(usageMessage());
  }

  if (HELP_WORDS.has(normalizeCommandPart(parts[0]))) {
    throw new Error(usageMessage());
  }

  if (COMMAND_PREFIXES.has(normalizeCommandPart(parts[0]))) {
    parts.shift();
  }

  const actionIndex = parts.findIndex((part) => ACTION_ALIASES[normalizeCommandPart(part)]);
  const batchIndex = parts.findIndex((part) => /^AT-[A-Z0-9-_]+$/i.test(part));
  const aliasIndex = parts.findIndex((part, index) => aliasToBatchId(part, parts[index + 1], aliasPrefix));
  const aliasMatch = aliasIndex >= 0 ? aliasToBatchId(parts[aliasIndex], parts[aliasIndex + 1], aliasPrefix) : null;
  const aliasIndexes = aliasMatch
    ? new Set(Array.from({ length: aliasMatch.width }, (_, offset) => aliasIndex + offset))
    : new Set();
  const actionType = actionIndex >= 0 ? ACTION_ALIASES[normalizeCommandPart(parts[actionIndex])] : null;
  const batchId = batchIndex >= 0
    ? parts[batchIndex]
    : aliasMatch?.batchId || null;

  if (!actionType || !batchId) {
    throw new Error(usageMessage());
  }

  const details = parts
    .filter((_, index) => index !== actionIndex && index !== batchIndex && !aliasIndexes.has(index))
    .join(" ");

  return {
    actionType,
    batchId: batchId.toUpperCase(),
    details: details || "sin detalles",
    alias: aliasMatch ? parts.slice(aliasIndex, aliasIndex + aliasMatch.width).join(" ").toUpperCase() : undefined,
  };
}

export function parseAidTraceCommand(text) {
  try {
    const r = parseAidTraceText(text);
    return { batchId: r.batchId, eventType: r.actionType, details: r.details };
  } catch {
    return null;
  }
}
