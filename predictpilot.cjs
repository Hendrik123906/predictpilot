// PredictPilot — agent core for the Solana Perps & Prediction Markets hackathon.
// Devnet ONLY (mock USDC, test SOL — nothing here has real value).
//
// Why this file exists: @solana/web3.js confirms transactions via a websocket
// subscription, and wss is broken behind this VM's egress proxy (TLS "wrong
// version number"). The official quickstart's txs DO land on-chain — only the
// confirmation times out. So we never use client.send.* / provider.sendAndConfirm.
// Instead we build instructions with client.ix.* and send + confirm them
// ourselves over plain HTTP (sendRawTransaction + getSignatureStatus polling).

require("./proxy-preload.cjs");
const fs = require("fs");
const {
  Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { AnchorProvider, Wallet } = require("@anchor-lang/core");
const { PmAmmClient, PROTOCOL_DAO } = require("@pm-amm/sdk");
const { i80f48ToNumber, priceFromReserves, estimateSwapOutput } = require("@pm-amm/sdk/math");
const {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
} = require("@solana/spl-token");

const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const APP = "https://pm-amm-devnet.vercel.app";
const PROGRAM_ID = new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ"); // devnet mUSDC
const WALLET_FILE = "./devnet-wallet.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadWallet() {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"))));
}

function makeClient(conn, kp) {
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  return PmAmmClient.fromProvider(provider, PROGRAM_ID, USDC_MINT);
}

// Send instructions and confirm over HTTP only (no websocket).
async function sendTx(conn, kp, ixs, label) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight });
  tx.add(...ixs);
  tx.sign(kp);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const start = Date.now();
  while (Date.now() - start < 90000) {
    const st = await conn.getSignatureStatus(sig);
    const v = st && st.value;
    if (v) {
      if (v.err) throw new Error(`${label || "tx"} failed: ${JSON.stringify(v.err)} (sig ${sig})`);
      if (v.confirmationStatus === "confirmed" || v.confirmationStatus === "finalized") return sig;
    }
    if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) {
      throw new Error(`${label || "tx"} expired (blockheight exceeded): ${sig}`);
    }
    await sleep(2000);
  }
  throw new Error(`${label || "tx"} not confirmed in 90s: ${sig}`);
}

function marketState(m) {
  const now = Math.floor(Date.now() / 1000);
  const endTs = m.endTs.toNumber();
  const lZero = i80f48ToNumber(m.lZero);
  const lEff = lZero * Math.sqrt(Math.max(endTs - now, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - m.lastAccrualTs.toNumber(), 1));
  const x = i80f48ToNumber(m.reserveYes) * (lEff / lLast);
  const y = i80f48ToNumber(m.reserveNo) * (lEff / lLast);
  return { x, y, lEff, price: priceFromReserves(x, y, lEff) };
}

async function ataIx(payer, owner, mint) {
  // allowOwnerOffCurve: the DAO fee recipient is a PDA (off-curve).
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  return createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, mint);
}

async function main() {
  const [cmd, marketArg, amountArg] = process.argv.slice(2);
  const conn = new Connection(RPC, "confirmed");
  const kp = loadWallet();
  const client = makeClient(conn, kp);

  if (cmd === "buy-yes" || cmd === "buy-no") {
    const market = new PublicKey(marketArg);
    const amountUsdc = Number(amountArg || 5);
    const m = await client.fetchMarket(market);
    if (!m) throw new Error("market not found");
    const st = marketState(m);
    console.log(`YES price before: ${(st.price * 100).toFixed(2)}%`);
    const dir = cmd === "buy-yes" ? "usdcToYes" : "usdcToNo";
    const amountIn = Math.round(amountUsdc * 1e6);
    const { output } = estimateSwapOutput(st.x, st.y, st.lEff, amountIn * 0.98, cmd === "buy-yes" ? "yes" : "no");
    const minOut = Math.floor(output * 0.99);
    const pre = [
      await ataIx(kp.publicKey, kp.publicKey, client.yesMint(market)),
      await ataIx(kp.publicKey, kp.publicKey, client.noMint(market)),
      await ataIx(kp.publicKey, kp.publicKey, USDC_MINT),
      await ataIx(kp.publicKey, PROTOCOL_DAO, USDC_MINT),
    ];
    const ix = await client.ix.swap({
      signer: kp.publicKey,
      market,
      direction: dir,
      amountIn,
      minOutput: minOut,
      creatorAuthority: m.authority,
      collateralMint: m.collateralMint,
    });
    const sig = await sendTx(conn, kp,
      // SDK uses CU.HEAVY = 1.4M for swaps (the swap alone needs ~365k+).
      [ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ...pre, ix],
      `${cmd} ${amountUsdc} mUSDC`);
    console.log(`bought ${cmd === "buy-yes" ? "YES" : "NO"} for ${amountUsdc} mUSDC — sig ${sig}`);
    await sleep(1000);
    const m2 = await client.fetchMarket(market);
    console.log(`YES price after: ${(marketState(m2).price * 100).toFixed(2)}%`);
    const bal = await conn.getTokenAccountBalance(
      getAssociatedTokenAddressSync(client[cmd === "buy-yes" ? "yesMint" : "noMint"](market), kp.publicKey));
    console.log(`${cmd === "buy-yes" ? "YES" : "NO"} balance: ${bal.value.uiAmountString}`);
    console.log(`open it: ${APP}/market/${m.marketId.toString()}`);
    return;
  }
  console.log("usage: node predictpilot.cjs buy-yes|buy-no <marketPda> [amountUsdc]");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
