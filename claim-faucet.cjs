// PredictPilot — faucet top-up (best-effort, never fails hard).
// POSTs the pm-AMM devnet faucet for 1,000 mUSDC + 0.2 devnet SOL.
// Limit: 1 claim per wallet per hour. If the faucet refuses (rate limit),
// log it and exit 0 — the cycle runs on whatever funds exist.
// Confirmation is HTTP-only (getSignatureStatus polling): the VM's egress
// proxy breaks Solana websocket confirmation, same as predictpilot.cjs.
require("./proxy-preload.cjs");
const fs = require("fs");
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");

const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const APP = "https://pm-amm-devnet.vercel.app";
const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitSig(conn, sig, label) {
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const st = await conn.getSignatureStatus(sig);
    if (st?.value) {
      if (st.value.err) throw new Error(`${label} failed: ${JSON.stringify(st.value.err)}`);
      if (st.value.confirmationStatus === "confirmed" || st.value.confirmationStatus === "finalized") return;
    }
    await sleep(2000);
  }
  console.log(`${label}: not confirmed in 60s (sig ${sig}) — continuing anyway`);
}

(async () => {
  const conn = new Connection(RPC, "confirmed");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("./devnet-wallet.json", "utf8"))));
  const owner = kp.publicKey;
  const sol = (await conn.getBalance(owner, "confirmed")) / LAMPORTS_PER_SOL;
  let musdc = 0;
  try {
    musdc = Number((await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(USDC_MINT, owner), "confirmed")).value.uiAmount);
  } catch { musdc = 0; }
  console.log(`before: ${sol.toFixed(3)} SOL, ${musdc.toFixed(2)} mUSDC`);
  if (sol >= 0.08 && musdc >= 100) {
    console.log("funds sufficient, skipping faucet claim");
    return;
  }
  console.log("claiming faucet…");
  const res = await fetch(`${APP}/api/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: owner.toBase58() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`faucet refused (${res.status}): ${body.error || "unknown"} — continuing with existing funds`);
    return;
  }
  if (body.signature) await waitSig(conn, body.signature, "faucet");
  if (body.sol) console.log(`faucet also sent ${body.sol} devnet SOL`);
  const sol2 = (await conn.getBalance(owner, "confirmed")) / LAMPORTS_PER_SOL;
  console.log(`after: ${sol2.toFixed(3)} SOL`);
})().catch((e) => {
  console.log(`faucet check failed (${e.message}) — continuing with existing funds`);
});
