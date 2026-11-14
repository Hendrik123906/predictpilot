# PredictPilot — demo video script (draft, 15 Nov 2026)

Target: 60–75s, 720x1280 (vertical, like StockPilot v2). Record from the LIVE
Pages URL once pushed (https://hendrik123906.github.io/predictpilot/);
fallback: local serve under /predictpilot (see probe-predictpilot.mjs).
Pipeline: Playwright Firefox record + TTS (Helio avocado_v2:MAI_03, en) +
ffmpeg assembly — same as demo-video-tooling/make-final-stockpilot-v2.sh.
NEVER media.generate_video (blocked 403).

## Narration (spell-outs for TTS)

1. "Prediction markets are broken for most people. Creating one takes code,
   capital, and a team. PredictPilot does it alone — every hour, on Solana."
2. "This is the live dashboard. The agent watches SOL, compares it to its
   one-hour moving average, and opens a new market: will SOL be above the
   strike when the hour ends?"
3. "It seeds each market with twenty mock U S D C of liquidity, then trades
   its own signal. Momentum up — it buys YES. Momentum down — it buys NO.
   Sideways — it just provides liquidity."
4. "When the hour ends, the agent resolves the market from the real SOL
   price and claims its winnings. Every step is a real transaction on
   Solana devnet — you can verify each one on Solscan."
5. "PredictPilot is built on pm-A M M, the prediction-market A M M, for the
   Solana Perps and Prediction Markets Hackathon. Autonomous markets,
   autonomous conviction — open source, live on devnet."

## Shots (1280x800 viewport, caption bar bottom)

1. Dashboard hero + stats (SOL price, markets created, settled calls).
2. Scroll to markets list — live market with YES% + resolved market.
3. Activity feed — create / trade / resolve / claim rows.
4. pm-AMM app market page (https://pm-amm-devnet.vercel.app/market/<id>)
   — the market anyone can trade against the agent.
5. How-it-works + contracts section (program ID, agent wallet).
6. Repo (github.com/Hendrik123906/predictpilot) — code is public.

## X post draft (for the submission post, tag @solana + hackathon)

"Meet PredictPilot 🤖📈 An autonomous agent that creates SOL prediction
markets on pm-AMM every hour — and trades its own momentum signal.
Live on Solana devnet. Dashboard + code below 👇
[video]
#Solana #PredictionMarkets"

(Keep under 280 chars counting URL as 23; verify before posting.)
