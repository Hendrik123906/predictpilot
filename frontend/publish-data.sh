#!/usr/bin/env bash
# Copy the agent's live logs into the dashboard's public/ dir before each build/deploy.
# Run from the quickstart/ directory (or anywhere — paths are absolute).
set -euo pipefail
Q=~/workspace/bounties/solana-perps-predictpilot/quickstart
F=~/workspace/bounties/solana-perps-predictpilot/quickstart/frontend
cp "$Q/markets.json" "$F/public/markets.json"
cp "$Q/activity.json" "$F/public/activity.json"
echo "synced markets.json + activity.json -> frontend/public/"
