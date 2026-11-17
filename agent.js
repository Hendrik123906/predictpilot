// PredictPilot agent v1 — autonomous prediction-market agent on pm-AMM (devnet).
//
// One cycle: fetch SOL price (Yahoo) -> create a 1h (or 5m --test) market
// "SOL > $strike by HH:MM?" -> trade by the StockPilot momentum rule
// (price > MA(1h) AND rising 15m -> buy YES; price < MA AND falling -> buy NO;
// else no directional trade, agent is just the LP) -> wait for expiry ->
// resolve by the real price at endTs -> claim winnings + LP residuals.
// Every decision + tx signature is logged to activity.json; markets to markets.json.
//
// Devnet ONLY. Sends go through lib-style HTTP confirmation (see predictpilot.cjs
// header for why: websocket confirmation is broken behind this VM's proxy).
// Helpers are duplicated from predictpilot.cjs on purpose for v1 (single file).

require("./proxy-preload.cjs");
const fs = require("fs");
const {
  Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram, LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { AnchorProvider, Wallet } = require("@anchor-lang/core");
const { PmAmmClient, PROTOCOL_DAO, randomU48 } = require("@pm-amm/sdk");
const { i80f48ToNumber, priceFromReserves, estimateSwapOutput } = require("@pm-amm/sdk/math");
const {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
} = require("@solana/spl-token");

const RPC = process.env.RPC_URL || "https://api.devnet.solana.com";
const APP = "https://pm-amm-devnet.vercel.app";
const PROGRAM_ID = new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ");
const WALLET_FILE = "./devnet-wallet.json";
const HISTORY_FILE = "./price-history.json";
const MARKETS_FILE = "./markets.json";
const ACTIVITY_FILE = "./activity.json";
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry helper for the public devnet RPC's HTTP 429 rate limits (settle step).
// Retries ONLY rate-limit-like errors; any other error throws immediately.
// Safe to re-run settle(): it returns early if the market is already resolved,
// and the LP-claim step already swallows its own errors.
const isRateLimit = (e) => /429|rate limit|too many requests/i.test(String((e && e.message) || e));
async function withSettleRetry(fn, label) {
  const waits = [30000, 60000, 120000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimit(e) || attempt >= waits.length) throw e;
      console.log(`${label}: rate-limited (attempt ${attempt + 1}), retrying in ${waits[attempt] / 1000}s...`);
      await sleep(waits[attempt]);
    }
  }
}
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2));
function logActivity(e) {
  const a = readJson(ACTIVITY_FILE, []);
  a.push({ ts: new Date().toISOString(), ...e });
  writeJson(ACTIVITY_FILE, a);
  console.log(`[${e.type}]`, e.note || "", e.sig || "");
}

function loadWallet() {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"))));
}
function makeClient(conn, kp) {
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  return PmAmmClient.fromProvider(provider, PROGRAM_ID, USDC_MINT);
}

// --- HTTP-only send (no websocket) -------------------------------------------
async function sendTx(conn, kp, ixs, label, cu = 1400000) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: cu }), ...ixs);
  tx.sign(kp);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const start = Date.now();
  while (Date.now() - start < 90000) {
    const st = await conn.getSignatureStatus(sig);
    const v = st && st.value;
    if (v) {
      if (v.err) throw new Error(`${label} failed: ${JSON.stringify(v.err)} (sig ${sig})`);
      if (v.confirmationStatus === "confirmed" || v.confirmationStatus === "finalized") return sig;
    }
    if ((await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) {
      throw new Error(`${label} expired (blockheight exceeded): ${sig}`);
    }
    await sleep(2000);
  }
  throw new Error(`${label} not confirmed in 90s: ${sig}`);
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
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  return createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, mint);
}

// --- Yahoo price --------------------------------------------------------------
async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=15m`;
  let lastErr;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const res = await fetch(url.replace("query1.finance.yahoo.com", host), { headers: UA, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r) throw new Error("empty chart result");
      const price = r.meta && r.meta.regularMarketPrice;
      if (!price) throw new Error("no regularMarketPrice");
      const ts = r.timestamp || [];
      const closes = (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close || [])
        .map((c, i) => ({ t: ts[i] * 1000, price: c }))
        .filter((p) => typeof p.price === "number");
      return { price, closes };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("yahoo fetch failed");
}

function ma1h(closes) {
  const last4 = closes.slice(-4).map((p) => p.price);
  if (last4.length < 4) return null;
  return last4.reduce((a, b) => a + b, 0) / last4.length;
}

// --- Market ops ---------------------------------------------------------------
async function createMarket(conn, kp, client, { name, durationSecs, depositUsdc }) {
  const authority = kp.publicKey;
  const marketId = randomU48();
  const market = client.marketPda(marketId);
  const endTs = Math.floor(Date.now() / 1000) + durationSecs;
  const initIx = await client.ix.initializeMarket({
    authority, marketId, endTs, name, initialPriceBps: 5000, collateralMint: USDC_MINT,
  });
  const ixs = [initIx];
  if (depositUsdc > 0) {
    ixs.push(await ataIx(authority, authority, USDC_MINT));
    ixs.push(await client.ix.depositLiquidity({
      signer: authority, market, amount: Math.round(depositUsdc * 1e6), collateralMint: USDC_MINT,
    }));
  }
  const sig = await sendTx(conn, kp, ixs, "createMarket");
  return { market, marketId: marketId.toString(), endTs, sig };
}

async function trade(conn, kp, client, market, side, amountUsdc) {
  const m = await client.fetchMarket(market);
  if (!m) throw new Error("market not found");
  const st = marketState(m);
  const dir = side === "yes" ? "usdcToYes" : "usdcToNo";
  const amountIn = Math.round(amountUsdc * 1e6);
  const { output } = estimateSwapOutput(st.x, st.y, st.lEff, amountIn * 0.98, side);
  const minOut = Math.floor(output * 0.99);
  const pre = [
    await ataIx(kp.publicKey, kp.publicKey, client.yesMint(market)),
    await ataIx(kp.publicKey, kp.publicKey, client.noMint(market)),
    await ataIx(kp.publicKey, kp.publicKey, USDC_MINT),
    await ataIx(kp.publicKey, PROTOCOL_DAO, USDC_MINT),
  ];
  const ix = await client.ix.swap({
    signer: kp.publicKey, market, direction: dir, amountIn, minOutput: minOut,
    creatorAuthority: m.authority, collateralMint: m.collateralMint,
  });
  const sig = await sendTx(conn, kp, [...pre, ix], `buy-${side.toUpperCase()} ${amountUsdc} mUSDC`);
  const m2 = await client.fetchMarket(market);
  return { sig, priceAfter: marketState(m2).price };
}

async function tokenBalance(conn, kp, client, market, side) {
  try {
    const ata = getAssociatedTokenAddressSync(client[side === "yes" ? "yesMint" : "noMint"](market), kp.publicKey);
    return (await conn.getTokenAccountBalance(ata)).value.uiAmount || 0;
  } catch { return 0; }
}

async function settle(conn, kp, client, rec) {
  const market = new PublicKey(rec.pda);
  const m = await client.fetchMarket(market);
  if (!m) throw new Error("settle: market not found");
  if (m.winningSide !== 0) {
    console.log("already resolved, winningSide =", m.winningSide.toNumber());
    return { alreadyResolved: true };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now < m.endTs.toNumber()) {
    console.log(`market not ended yet (ends in ${m.endTs.toNumber() - now}s)`);
    return { notEnded: true };
  }
  const { price } = await fetchYahoo("SOL-USD");
  const outcome = price > rec.strike ? "yes" : "no";
  console.log(`SOL at expiry: $${price} vs strike $${rec.strike} -> ${outcome.toUpperCase()}`);
  const resolveSig = await sendTx(conn, kp,
    [await client.ix.resolveMarket({ signer: kp.publicKey, market, side: outcome })],
    "resolveMarket", 400000);
  logActivity({ type: "resolve", market: rec.pda, outcome, priceAtExpiry: price, strike: rec.strike, sig: resolveSig, note: `resolved ${outcome.toUpperCase()} (SOL $${price} vs $${rec.strike})` });
  // Post-resolution LP path per the API reference: claim_lp_residuals FIRST
  // (it mints pending YES/NO residuals), THEN claim_winnings (burns all YES/NO,
  // pays 1 mUSDC per winning token). Reversed order would strand residuals.
  try {
    const pre = [
      await ataIx(kp.publicKey, kp.publicKey, client.yesMint(market)),
      await ataIx(kp.publicKey, kp.publicKey, client.noMint(market)),
    ];
    const ix = await client.ix.claimLpResiduals({ signer: kp.publicKey, market });
    const lpSig = await sendTx(conn, kp, [...pre, ix], "claimLpResiduals");
    logActivity({ type: "claim-lp", market: rec.pda, sig: lpSig, note: "claimed LP residuals" });
  } catch (e) {
    console.log("claimLpResiduals skipped:", e.message.slice(0, 140));
  }
  // Claim winnings if holding the winning side (after residuals, so the
  // freshly minted winning residuals are included in the same claim).
  const winBal = await tokenBalance(conn, kp, client, market, outcome);
  let claimSig = null;
  if (winBal > 0) {
    const pre = [
      await ataIx(kp.publicKey, kp.publicKey, client.yesMint(market)),
      await ataIx(kp.publicKey, kp.publicKey, client.noMint(market)),
      await ataIx(kp.publicKey, kp.publicKey, USDC_MINT),
    ];
    const ix = await client.ix.claimWinnings({ signer: kp.publicKey, market, collateralMint: USDC_MINT });
    claimSig = await sendTx(conn, kp, [...pre, ix], "claimWinnings");
    logActivity({ type: "claim", market: rec.pda, amount: winBal, sig: claimSig, note: `claimed ${winBal} mUSDC winnings` });
  } else {
    console.log("no winning tokens to claim");
  }
  return { outcome, priceAtExpiry: price, claimSig, resolveSig };
}

// --- Cycle --------------------------------------------------------------------
async function cycle(test) {
  const conn = new Connection(RPC, "confirmed");
  const kp = loadWallet();
  const client = makeClient(conn, kp);
  const durationSecs = test ? 360 : 3600; // on-chain rule: end_ts >= now+300s AT EXECUTION time — 300 exactly fails (tx lands seconds later)
  const depositUsdc = test ? 20 : 50;
  const tradeUsdc = test ? 5 : 10;

  const { price, closes } = await fetchYahoo("SOL-USD");
  const h = readJson(HISTORY_FILE, {});
  h.SOL = (h.SOL || []).concat(closes.filter((p) => p.price > 0));
  // keep last 400 points
  h.SOL = h.SOL.slice(-400);
  h.SOL.push({ t: Date.now(), price });
  writeJson(HISTORY_FILE, h);
  const ma = ma1h(h.SOL);
  const prev = h.SOL.length >= 2 ? h.SOL[h.SOL.length - 2].price : price;
  const rising = price > prev;
  console.log(`SOL $${price} | MA(1h) ${ma ? "$" + ma.toFixed(2) : "n/a"} | 15m ${rising ? "naik" : "turun"}`);

  const strike = Math.round(price * 100) / 100;
  const endLabel = new Date(Date.now() + durationSecs * 1000).toTimeString().slice(0, 5);
  const name = `SOL > $${strike} by ${endLabel}?`;
  const { market, marketId, endTs, sig } = await createMarket(conn, kp, client, { name, durationSecs, depositUsdc });
  console.log(`market created: ${market.toBase58()} (id ${marketId})`);
  console.log(`open it: ${APP}/market/${marketId}`);
  logActivity({ type: "create", market: market.toBase58(), marketId, name, strike, depositUsdc, sig, note: `created "${name}" (${depositUsdc} mUSDC LP)` });

  const rec = { pda: market.toBase58(), marketId, name, symbol: "SOL", strike, endTs, createdAt: new Date().toISOString(), depositUsdc };
  const markets = readJson(MARKETS_FILE, []);
  markets.push(rec);
  writeJson(MARKETS_FILE, markets);

  // Momentum trade (StockPilot rule).
  let side = null;
  if (ma && price > ma && rising) side = "yes";
  else if (ma && price < ma && !rising) side = "no";
  if (side) {
    const { sig: tsig, priceAfter } = await trade(conn, kp, client, market, side, tradeUsdc);
    rec.tradeSide = side; rec.tradeAmount = tradeUsdc;
    writeJson(MARKETS_FILE, markets);
    logActivity({ type: "trade", market: market.toBase58(), side, amount: tradeUsdc, sig: tsig, note: `bought ${side.toUpperCase()} ${tradeUsdc} mUSDC (momentum) -> YES ${(priceAfter * 100).toFixed(1)}%` });
  } else {
    console.log("no momentum signal — LP only, no directional trade");
    logActivity({ type: "trade-skip", market: market.toBase58(), note: "no momentum signal (price vs MA/15m flat) — LP only" });
  }

  // Wait for expiry, then settle.
  const waitMs = (endTs - Math.floor(Date.now() / 1000) + 15) * 1000;
  console.log(`waiting ${Math.round(waitMs / 1000)}s for market expiry...`);
  await sleep(waitMs);
  const res = await withSettleRetry(() => settle(conn, kp, client, rec), "settle");
  rec.settled = res;
  writeJson(MARKETS_FILE, markets);
  const bal = await conn.getBalance(kp.publicKey);
  console.log(`cycle done. wallet: ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  return rec;
}

async function main() {
  const [cmd, arg1] = process.argv.slice(2);
  const conn = new Connection(RPC, "confirmed");
  const kp = loadWallet();
  const client = makeClient(conn, kp);
  if (cmd === "cycle") {
    await cycle(arg1 === "--test");
    return;
  }
  if (cmd === "settle") {
    const markets = readJson(MARKETS_FILE, []);
    const rec = markets.find((m) => m.pda === arg1) || { pda: arg1, strike: Number(process.argv[3]) };
    if (!rec.strike) throw new Error("settle needs a markets.json entry or a strike: node agent.js settle <pda> <strike>");
    await withSettleRetry(() => settle(conn, kp, client, rec), "settle");
    return;
  }
  console.log("usage: node agent.js cycle [--test] | node agent.js settle <marketPda> [strike]");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
