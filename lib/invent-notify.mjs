const INVENT_API_BASE = 'https://api.useinvent.com';

export async function sendInventReply({ chatId, text }) {
  const apiKey = process.env.AIDTRACE_INVENT_API_KEY;
  if (!apiKey) {
    throw new Error('AIDTRACE_INVENT_API_KEY not configured');
  }

  const url  = `${INVENT_API_BASE}/orgs/c/chats/${chatId}/messages`;
  const body = JSON.stringify({ text });

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '(no body)');
    throw new Error(`Invent API error ${response.status}: ${errText}`);
  }

  return response.json();
}

export function buildFinalReply({ batchId, eventType, details, txHash, channel }) {
  const celoscanUrl = `https://celoscan.io/tx/${txHash}`;

  if (channel === 'sms') {
    return `AidTrace OK: ${eventType} ${batchId}. Tx: ${celoscanUrl}`;
  }

  return (
    `✅ *Registrado en Celo*: ${eventType} ${batchId}\n` +
    `📦 Detalles: ${details}\n` +
    `🔗 Tx: ${celoscanUrl}\n` +
    `🔍 Auditoría: abrí el link → Logs → data / referenceURI`
  );
}
