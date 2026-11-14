# PredictPilot — hackathon submission draft (Solana Perps & Prediction Markets)

Status: DRAFT. Do not submit until the repo is pushed and the dashboard is
live on GitHub Pages (PAT fix pending). Deadline: 6 Dec 2026 (aim 5 Dec).
Registration: user registers himself from his phone (Google sign-in from the
cloud browser kept looping verification).

## Project
- **Name:** PredictPilot
- **Tagline:** An autonomous agent that creates SOL price prediction markets
  on pm-AMM and trades its own momentum signal.
- **Tracks:** Main track (Perps & Prediction Markets) + PREDICT Spark bounty
  (Best use of pm-AMM).

## Description (for the form)
PredictPilot is an autonomous agent that runs a full prediction-market loop
on Solana devnet every hour: it fetches the live SOL price, compares it to
its 1-hour moving average and 15-minute direction, opens a new
"SOL > $strike by next hour?" market on pm-AMM seeded with 50 mock USDC of
liquidity, trades 10 mock USDC on its own momentum signal (YES when price is
above the average and rising, NO when below and falling, liquidity-only when
flat), then resolves the market from the real SOL price at expiry and claims
LP residuals first and winnings second — the exact order the pm-AMM
reference requires. Every step is a real devnet transaction, verifiable on
Solscan, and the live dashboard reads markets, prices and activity straight
from the chain. A 2-hour cron keeps the loop running hands-free, topping up
test SOL/mock USDC from the faucet when low.

## Links
- Repo: https://github.com/Hendrik123906/predictpilot
- Dashboard: https://hendrik123906.github.io/predictpilot/ (PENDING — push + Pages deploy)
- Demo video: quickstart/demo/predictpilot-demo-v2.mp4 (77s, narrated,
  recorded from the live Pages URL)
- **X post (LIVE 15 Nov 05:09 WIB): https://x.com/Selimar30/status/2121727338807435697**
  (video v2 attached, verified playable)
- Example live market: https://pm-amm-devnet.vercel.app/market/60479092625082
- pm-AMM program (devnet): GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y
- Agent wallet (devnet only): 5hkydCE14hV7SzhFyuAsWPpmkguv1Pk4VqKR7dBFTRcz

## Team
- Bambang Hendri Susanto (solo) — GitHub Hendrik123906, X @Selimar30,
  email bambanghendri71@gmail.com
- Payout wallet (if asked, Solana): DxW1uoduzWd3eNqLfKar6froyHzai8gNbAR78GT7dr8t
  (user's OKX Solana address — NOT the devnet agent wallet)

## Traction so far (honest numbers)
- Test cycle #2 (15 Nov 04:24-04:31): market created, YES bought, prediction
  CORRECT, 24.899999 mUSDC winnings claimed. 1W-0L.
- Prod cycle #1: market "SOL > $70.48 by 05:43?" live, LP-only (no momentum
  signal), settles ~05:43 WIB 15 Nov.
- Auto-cycle cron every 2h active from 06:47 WIB 15 Nov (faucet top-up +
  flock lock + dashboard data sync).
- Dashboard: Next.js static export, live devnet reads (markets, balances,
  SOL price), activity feed with Solscan links.

## Honest limitations (do not hide these)
- Devnet only; mock USDC + test SOL — nothing here has real value.
- pm-AMM is an unaudited proof-of-concept; resolution is manual by the
  market authority; no audit.
- First devnet RPC call through the VM proxy takes ~14s; Solana websocket
  confirmation is broken behind the proxy, so the agent confirms over HTTP
  only (sendRawTransaction + getSignatureStatus polling).
