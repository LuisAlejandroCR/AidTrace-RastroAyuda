import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

const RELAYER_ADDRESS = (
  process.env.AIDTRACE_RELAYER_ADDRESS ||
  "0x3dbb8633cbB45db718B8D72F14AE36E151695181"
).toLowerCase();
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CELOSCAN_ADDRESS_BASE =
  process.env.CELOSCAN_ADDRESS_BASE || "https://celoscan.io/address";
const EST_GAS_PER_PROOF = 37000n;
const CACHE_TTL_MS = 30000;
let cached = null;
let cacheAt = 0;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "public, max-age=30");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const now = Date.now();
    if (!cached || now - cacheAt > CACHE_TTL_MS) {
      const publicClient = createPublicClient({
        chain: celo,
        transport: http(CELO_RPC_URL),
      });

      const [balance, gasPrice] = await Promise.all([
        publicClient.getBalance({ address: RELAYER_ADDRESS }),
        publicClient.getGasPrice(),
      ]);

      const estCostWei = BigInt(gasPrice) * EST_GAS_PER_PROOF;

      cached = {
        ok: true,
        address: RELAYER_ADDRESS,
        addressUrl: `${CELOSCAN_ADDRESS_BASE}/${RELAYER_ADDRESS}`,
        balanceCelo: Number(balance) / 1e18,
        gasPriceGwei: Number(gasPrice) / 1e9,
        estCostPerProofCelo: Number(estCostWei) / 1e18,
        estProofsLeft: estCostWei > 0n ? Number(balance / estCostWei) : 0,
        updatedAt: new Date().toISOString(),
      };
      cacheAt = now;
    }

    return res.status(200).json(cached);
  } catch (error) {
    console.error("Relayer status error:", error);
    return res.status(500).json({ ok: false, error: "Relayer status unavailable" });
  }
}