import { processQueuedAidTraceMessage } from "./zavu.mjs";

const WORKER_TOKEN = process.env.AIDTRACE_QUEUE_WORKER_TOKEN || "";
const DEFAULT_BATCH_SIZE = Number(process.env.AIDTRACE_QUEUE_BATCH_SIZE || "1");
const MAX_BATCH_SIZE = Number(process.env.AIDTRACE_QUEUE_MAX_BATCH_SIZE || "5");

function hasValidWorkerToken(req) {
  if (!WORKER_TOKEN) return false;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const explicit = String(req.headers["x-aidtrace-worker-token"] || "");
  return bearer === WORKER_TOKEN || explicit === WORKER_TOKEN;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (!hasValidWorkerToken(req)) {
    return res.status(401).send("Unauthorized");
  }

  if (process.env.AIDTRACE_QUEUE_ENABLED !== "true") {
    return res.status(409).json({
      ok: false,
      error: "AIDTRACE_QUEUE_ENABLED is not true",
    });
  }

  try {
    const requestedBatchSize = Number(req.query?.limit || DEFAULT_BATCH_SIZE);
    const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Number.isFinite(requestedBatchSize) ? requestedBatchSize : 1));
    const results = [];

    for (let index = 0; index < batchSize; index += 1) {
      const result = await processQueuedAidTraceMessage();
      results.push(result);
      if (!result.processed) break;
    }

    const failed = results.some((result) => !result.ok);
    return res.status(failed ? 207 : 200).json({
      ok: !failed,
      processed: results.filter((result) => result.processed).length,
      results,
    });
  } catch (error) {
    console.error("Queue processor error:", error);
    return res.status(500).json({
      ok: false,
      error: "Queue processor error",
    });
  }
}
