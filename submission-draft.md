# PredictPilot — hackathon submission draft (Solana Perps & Prediction Markets)

Status: READY TO SUBMIT once the site opens submissions (still SCHEDULED as of
17 Nov 14:26 WIB — 671 registered, 0 submissions; watch cron
`predictpilot-submit-watch` checks every 2h). Deadline: 5 Dec 2026.
Repo pushed + dashboard LIVE (verified 17 Nov 14:43 WIB).
Registration: user registered as @bambang7010 (profile
https://hackathons.solana.com/u/bf1f78e6-3ed1-4806-b876-30cf0893630d),
wallet DxW1 linked.

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
- Repo: https://github.com/Hendrik123906/predictpilot (public, main 393f3bb+)
- Dashboard: https://hendrik123906.github.io/predictpilot/ — LIVE (verified 17 Nov 14:43 WIB)
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

## Traction so far (honest numbers, verified 17 Nov 14:43 WIB from activity.json)
- **27 markets created, 27 resolved, 27 claims, 27 LP claims** (15–17 Nov)
- **14 momentum trades, 135 mUSDC traded** (10 mUSDC each; 13 cycles LP-only,
  no signal) — settled-trade record **6W–8L**
- **1,320 mUSDC LP seeded** across the 27 markets (50 mUSDC each)
- Auto-cycle cron every 2h running hands-free since 15 Nov 06:47 WIB
  (faucet top-up + flock lock + dashboard data sync)
- Dashboard: static export, live devnet reads (markets, balances,
  SOL price), activity feed with Solscan links
- Latest cycle 17 Nov 12:47 WIB: market "SOL > $72.85 by 06:47?" resolved NO
  (SOL $72.59), YES trade lost, 59.799999 mUSDC claimed — net ~−0.2 mUSDC

## Honest limitations (do not hide these)
- Devnet only; mock USDC + test SOL — nothing here has real value.
- pm-AMM is an unaudited proof-of-concept; resolution is manual by the
  market authority; no audit.
- First devnet RPC call through the VM proxy takes ~14s; Solana websocket
  confirmation is broken behind the proxy, so the agent confirms over HTTP
  only (sendRawTransaction + getSignatureStatus polling).
- Auto-settle hits HTTP 429 on the public devnet RPC most cycles; settle is
  recovered manually (retry succeeds). No real users yet — all activity is
  the agent's own cycles; that is the honest traction gap vs the pm-AMM
  bounty criteria (real users / volume / fees).
