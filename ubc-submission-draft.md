# PredictPilot — UBC 2026 Hackathon submission (Devpost)

Deadline: Fri 20 Nov 2026 12:00 PM CST = Sat 21 Nov 01:00 WIB.
Devpost: https://ubc-hackathon-2026.devpost.com/
Status: DRAFT — video v3 in production, YouTube upload + Devpost submit pending.

## Form values

- **Project name:** PredictPilot
- **Tagline:** An autonomous agent that creates SOL price prediction markets on pm-AMM and trades its own momentum signal.
- **Main track:** Agentic Payments and AI
- **Chain award:** Best use of Solana ($1,500)
- **Bounties:** NONE (Gemini Prediction Markets bounty requirements unverified — PredictPilot trades pm-AMM, not Gemini; do not opt in blindly)
- **Repo:** https://github.com/Hendrik123906/predictpilot
- **Live demo:** https://hendrik123906.github.io/predictpilot/
- **Demo video:** YouTube link (v3, 2m14s) — PENDING upload
- **Team:** Bambang Hendri Susanto (solo) — GitHub Hendrik123906, X @Selimar30, email bambanghendri71@gmail.com

## Description (for the form)

PredictPilot is an autonomous agent that runs a full prediction-market loop on Solana devnet every hour: it fetches the live SOL price, compares it to its 1-hour moving average and 15-minute direction, opens a new "SOL > $strike by next hour?" market on pm-AMM seeded with 50 mock USDC of liquidity, trades 10 mock USDC on its own momentum signal (YES when price is above the average and rising, NO when below and falling, liquidity-only when flat), then resolves the market from the real SOL price at expiry and claims LP residuals first and winnings second — the exact order the pm-AMM reference requires. Every step is a real devnet transaction, verifiable on Solscan, and the live dashboard reads markets, prices and activity straight from the chain. A 2-hour cron keeps the loop running hands-free, topping up test SOL/mock USDC from the faucet when low.

## The 5 questions

**What did you build?** An autonomous agent (about 200 lines of Node) plus a live dashboard. Every two hours it creates a SOL prediction market on pm-AMM, seeds it with 50 mock USDC, trades 10 mock USDC on a momentum signal, resolves it from the real SOL price, and claims. The dashboard is a static site that reads everything live from Solana devnet.

**What problem does it solve?** Creating a prediction market today takes code, capital, and a team. PredictPilot shows markets can be created, funded, traded, and settled by one agent with no human in the loop — the market-making primitive for agent economies.

**How does it work?** Yahoo SOL price → 1h moving average + 15m direction → strike = current price → create market on pm-AMM (program GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y, devnet) with 50 mUSDC → momentum trade 10 mUSDC → wait for expiry → resolve from the real price → claim LP residuals first, then winnings. Confirmation is HTTP-only (Solana websockets do not survive the proxy it runs behind); swaps use a 1,400,000 compute budget.

**What makes it unique?** It is a complete closed loop — creation, liquidity, trading, resolution, claiming — run by an agent, not a demo script. Ten markets created on devnet with 47+ on-chain actions, including correct calls that banked winnings. It sits out flat markets instead of forcing trades.

**What would you build next?** Mainnet-ready risk limits, multi-asset markets (BTC, ETH), a reputation score per agent based on its settled record, and letting anyone copy-trade the agent's signal through the same pm-AMM markets.

## Technologies / sponsor tools

Node.js, Solana web3.js, pm-AMM Anchor program (devnet), GitHub Pages (Next.js static export), Yahoo Finance price feed.

## Track-specific requirements

- Contract/program addresses used: pm-AMM program GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y (devnet); mock USDC 3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ; agent devnet wallet 5hkydCE14hV7SzhFyuAsWPpmkguv1Pk4VqKR7dBFTRcz.
- Example live market: https://pm-amm-devnet.vercel.app/market/69110166293201
- Example claim tx: https://solscan.io/tx/3BvG2fEabAfabWJFJ3oGG32dRgGogd4XFUDoL1aHjAx7zbENiCFdi1xHZMEYyfJb8YZMiT6HL9pV1SQHMCztewYC?cluster=devnet

## Honest notes (for the agent, NOT for the form)

- Devnet only; mock USDC + test SOL — nothing here has real value. pm-AMM is an unaudited proof-of-concept; resolution is manual by the market authority.
- Project was created 15 Nov 2026, inside the UBC hack week (13–20 Nov) — eligible on the "created entirely during the hackathon week" rule.
- SAME project is also entered in the Solana Perps & Prediction Markets hackathon (user approved the dual submission 15 Nov 21:13 WIB). UBC rules do not explicitly forbid entering another hackathon, but a judge could see it as a reused project — accepted risk, user-approved.
- ⚠️ Finalists pitch IN PERSON in Austin, TX on Sat 21 Nov. The user is in Indonesia and cannot attend — realistic upside is the participation perks (ElevenLabs Creator 1mo + QuickNode $49 plan + X Premium for up to 300) plus an outside chance at track prizes. Do NOT promise a win.
- Prizes if won: cash via Devpost (PayPal/Payoneer/Wise path — user payout is OKX for crypto; Devpost is fiat-only, same as Kiroween).
