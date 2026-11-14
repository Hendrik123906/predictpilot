#!/usr/bin/env bash
# PredictPilot — one production cycle, safe to run from cron every 2h.
# - flock: skip if a cycle is already running (a cycle takes ~67 min).
# - claim-faucet.cjs: best-effort top-up (1/hour limit; refusal is fine).
# - agent.js cycle: 1h market, 50 mUSDC LP, momentum trade, settle + claim.
# - publish-data.sh: refresh the dashboard's public JSON after the cycle.
set -u
cd ~/workspace/bounties/solana-perps-predictpilot/quickstart || exit 1
exec 9>cycle.lock
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) cycle already running, skip"
  exit 0
fi
echo "=== cycle run $(date -u +%FT%TZ) ===" >> cycle-runs.log
node claim-faucet.cjs >> cycle-runs.log 2>&1 || true
node agent.js cycle >> cycle-runs.log 2>&1
rc=$?
./frontend/publish-data.sh >> cycle-runs.log 2>&1 || true
echo "=== cycle exit $rc $(date -u +%FT%TZ) ===" >> cycle-runs.log
exit $rc
