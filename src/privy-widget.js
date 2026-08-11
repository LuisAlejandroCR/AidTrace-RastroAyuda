import Privy, { LocalStorage } from "@privy-io/js-sdk-core";

// Scope: external-wallet connect + send only (SIWE login via Privy, then the
// wallet's own EIP-1193 provider signs/sends). Embedded wallets (email OTP,
// Privy-hosted keys) are intentionally out of scope: they need an iframe
// secure-context + password/recovery UX, and creating a fresh wallet doesn't
// solve "no crypto experience" anyway — it still needs external funding.

const CELO_CHAIN_ID = 42220;
const CELO_CHAIN_ID_HEX = "0x" + CELO_CHAIN_ID.toString(16);
const CELO_CHAIN_PARAMS = {
  chainId: CELO_CHAIN_ID_HEX,
  chainName: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: ["https://forno.celo.org"],
  blockExplorerUrls: ["https://celoscan.io"],
};

let privyClient = null;
let connectedAddress = null;

function getInjectedProvider() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return window.ethereum;
}

async function ensureClient(appId, clientId) {
  if (privyClient) return privyClient;
  privyClient = new Privy({
    appId,
    clientId: clientId || undefined,
    storage: new LocalStorage(),
  });
  await privyClient.initialize();
  return privyClient;
}

async function ensureCeloChain(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CELO_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [CELO_CHAIN_PARAMS],
      });
    } else {
      throw error;
    }
  }
}

async function connectWallet({ appId, clientId }) {
  const provider = getInjectedProvider();
  if (!provider) {
    const error = new Error("No injected wallet found");
    error.code = "no_injected_wallet";
    throw error;
  }

  const client = await ensureClient(appId, clientId);

  const [address] = await provider.request({ method: "eth_requestAccounts" });
  await ensureCeloChain(provider);

  const wallet = { address, chainId: `eip155:${CELO_CHAIN_ID}` };
  const { message } = await client.auth.siwe.init(wallet, window.location.host, window.location.origin);
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });
  await client.auth.siwe.loginWithSiwe(signature, wallet, message, "login-or-sign-up");

  connectedAddress = address;
  return { address };
}

async function sendDonation({ to, valueWei }) {
  const provider = getInjectedProvider();
  if (!provider || !connectedAddress) {
    const error = new Error("Wallet not connected");
    error.code = "not_connected";
    throw error;
  }
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: connectedAddress, to, value: valueWei }],
  });
  return { txHash };
}

window.AidTracePrivy = {
  connectWallet,
  sendDonation,
  getConnectedAddress: () => connectedAddress,
  hasInjectedWallet: () => !!getInjectedProvider(),
};
