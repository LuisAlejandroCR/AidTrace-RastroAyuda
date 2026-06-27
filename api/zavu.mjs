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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const event = req.body;

    console.log("Zavu event:", JSON.stringify(event, null, 2));

    if (event.type !== "message.inbound") {
      return res.status(200).send("Ignored");
    }

    const data = event.data || {};
    const channel = data.channel;
    const text = data.text;

    const to =
    channel === "telegram"
        ? data.telegramChatId
        : String(data.from || "").replace(/^(sms|whatsapp|telegram):/, "");

    if (!to || !channel) {
    return res.status(400).send("Missing recipient/channel");
    }

    await zavu.messages.send({
    to,
    channel,
    text: buildReply(text),
    idempotencyKey: `aidtrace-reply-${event.id}`,
    });

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).send("Webhook error");
  }
}