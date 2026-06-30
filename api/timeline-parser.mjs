export function bytes32ToText(value) {
  const clean = String(value || "")
    .replace(/^0x/, "")
    .replace(/(00)+$/g, "");

  if (!clean) return "";

  const bytes = clean.match(/.{1,2}/g).map((byte) => parseInt(byte, 16));
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0/g, "");
}

export function parseReferenceURI(referenceURI) {
  const parts = String(referenceURI || "")
    .split("|")
    .map((part) => part.trim());

  return {
    source: parts[0] || "",
    summary: parts[1] || "",
    details: parts.slice(2).join(" | ") || "",
  };
}
