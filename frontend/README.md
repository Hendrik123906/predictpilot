# PredictPilot dashboard

Next.js 16 static export (same scaffold as StockPilot). Reads live on-chain data
in the visitor's browser — no wallet needed:

- `PmAmmClient.readOnly` against `https://api.devnet.solana.com` — all
  pm-AMM markets, filtered to the agent wallet, with live YES% from the
  dynamic pm-AMM curve (`@pm-amm/sdk/math`).
- Agent mUSDC + SOL balances, SOL price from CoinGecko.
- `public/activity.json` + `public/markets.json` — the agent's trade log,
  copied fresh before each build by `publish-data.sh` (these files are
  generated, not committed — see the agent's `markets.json`/`activity.json`
  in the repo root).

## Build & preview

```bash
./publish-data.sh          # sync agent logs into public/
PAGES_BASE_PATH=/predictpilot npm run build
npx serve out -l 8933      # serves at /predictpilot/ via the probe script
```

Deploy: push `out/` to the `gh-pages` branch (GitHub auto-publishes project
sites from it) — same flow as StockPilot.

## Gotchas

- `@anchor-lang/core` requires `fs` in a Node-only code path; Turbopack is
  told to alias `fs` to `src/lib/empty.ts` in `next.config.ts`.
- The SDK version is `^0.2.0` (the `^1.0.0` line in npm is a phantom —
  only 0.1.0/0.2.0 exist). Mirror the agent's `package.json` versions.
- First devnet RPC call through the egress proxy takes ~14s; the dashboard
  refreshes every 30s.
