import Zavudev from "@zavudev/sdk";

const zavu = new Zavudev({
  apiKey: process.env.RASTROAYUDA_ZAVU_API_KEY,
});

function buildReply(text) {
  const clean = String(text || "").trim();

  const match = clean.match(
    /^AT\s+(PICKUP|DELIVER|REVIEW)\s+([A-Za-z0-9-_]+)\s*(.*)$/i
  );

  if (!match) {
    return "Formato no reconocido. Usa: AT PICKUP BATCH-001 detalles";
  }

  const action = match[1].toUpperCase();
  const batchId = match[2];
  const details = match[3] || "sin detalles";

  return `Registrado: ${action} para ${batchId}. Detalles: ${details}`;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const event = await request.json();

      if (event.type !== "message.inbound") {
        return new Response("Ignored", { status: 200 });
      }

      const { from, channel, text } = event.data || {};

      if (!from || !channel) {
        return new Response("Missing sender data", { status: 400 });
      }

      await zavu.messages.send({
        to: from,
        channel,
        text: buildReply(text),
        idempotencyKey: `reply-${event.id}`,
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Zavu webhook error:", error);
      return new Response("Webhook error", { status: 500 });
    }
  },
};