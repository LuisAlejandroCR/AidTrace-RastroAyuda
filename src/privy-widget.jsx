import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { celo } from "viem/chains";
import { useState } from "react";

// React island: mounted only when PRIVY_APP_ID is configured, into
// #privyReactRoot inside the Support modal. Uses the real Privy modal
// (email + external wallet, embedded wallet auto-created for email users)
// via @privy-io/react-auth — the same package/config shape already
// field-tested in the Choco for MiniPay project.

function shortAddress(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

function DonateWidget({ relayerAddress, amountWei, strings }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState("");
  const wallet = wallets[0] || null;

  async function handleSend(amount) {
    if (!wallet) return;
    setStatus(strings.sending);
    try {
      const provider = await wallet.getEthereumProvider();
      await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: relayerAddress, value: amountWei[amount] }],
      });
      setStatus(strings.sent);
    } catch {
      setStatus(strings.cancelled);
    }
  }

  if (!ready) return null;

  if (!authenticated || !wallet) {
    return (
      <div>
        <button className="primary compact" type="button" onClick={login}>
          {strings.connect}
        </button>
        <p className="privy-branding">{strings.protectedBy}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="privy-wallet-addr">{shortAddress(wallet.address)}</p>
      <div className="privy-amount-row">
        <button className="secondary compact" type="button" onClick={() => handleSend("0.5")}>0.5 CELO</button>
        <button className="secondary compact" type="button" onClick={() => handleSend("1")}>1 CELO</button>
        <button className="secondary compact" type="button" onClick={() => handleSend("5")}>5 CELO</button>
      </div>
      {status ? <p className="verify-hint">{status}</p> : null}
      <p className="privy-branding">{strings.protectedBy}</p>
    </div>
  );
}

function Root() {
  const config = window.__AIDTRACE_PRIVY_CONFIG__ || {};
  return (
    <PrivyProvider
      appId={config.appId}
      config={{
        loginMethods: ["email", "wallet"],
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        defaultChain: celo,
        supportedChains: [celo],
      }}
    >
      <DonateWidget
        relayerAddress={config.relayerAddress}
        amountWei={config.amountWei}
        strings={config.strings}
      />
    </PrivyProvider>
  );
}

const container = document.getElementById("privyReactRoot");
if (container) createRoot(container).render(<Root />);
