# PredictPilot

Autonomous prediction-market agent on Solana, built on the [pm-AMM](https://predict-pm-amm.dev/) — the open-source prediction-market AMM engine.

Entry for the **Solana Perps & Prediction Markets Hackathon** (deadline 5 Dec 2026, $100k main track).

## What it does

Every cycle, the agent:

1. Fetches the live SOL price (Yahoo Finance) and keeps a price history.
2. Creates a binary market on pm-AMM devnet — *"SOL > $strike by HH:MM?"* — seeded with mUSDC liquidity (the agent is the LP).
3. Trades by the momentum rule (same brain as StockPilot): price above the 1h moving average **and** rising over 15 min → buy YES; below MA and falling → buy NO; otherwise LP only.
4. After expiry, resolves the market from the real SOL price, claims winnings + LP residuals.

Every decision and transaction signature is logged to `activity.json`; markets to `markets.json`.

## Devnet only

Everything runs on **Solana devnet** with mock USDC (faucet) and test SOL. Nothing here touches mainnet or real money.

## Run it

```bash
npm install
node agent.js cycle --test   # 6-minute market, 20 mUSDC LP, 5 mUSDC trade
node agent.js cycle          # 1-hour market, 50 mUSDC LP, 10 mUSDC trade
node agent.js settle <marketPda> [strike]
```

Single trades: `node predictpilot.cjs buy-yes|buy-no <marketPda> [amountUsdc]`

## Why the custom send path

`@solana/web3.js` confirms transactions via a websocket subscription, and the
PM-AMM SDK's `send.*` methods use Anchor's `sendAndConfirm` (legacy
websocket confirmation). Behind some egress proxies wss fails while HTTPS
works — the transaction lands on-chain but confirmation times out after 30s.
`predictpilot.cjs` / `agent.js` therefore build instructions with
`client.ix.*` and send + confirm over plain HTTP
(`sendRawTransaction` + `getSignatureStatus` polling). No websocket anywhere.

## Gotchas (learned the hard way)

- Market duration must satisfy `end_ts >= now + 300s` **at execution time** —
  exactly 300s fails because the tx lands seconds later. Use 360s+ for tests.
- Swaps need a 1.4M compute-unit budget (`CU.HEAVY`); 400k fails with
  "exceeded CUs meter".
- The DAO fee-recipient ATA is a PDA (off-curve) — `getAssociatedTokenAddressSync`
  needs `allowOwnerOffCurve: true`.
- Post-resolution claim order matters: `claimLpResiduals` first, then
  `claimWinnings`, otherwise freshly minted winning residuals get stranded.
