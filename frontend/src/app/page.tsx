"use client";

import { useEffect, useState } from "react";
import {
  AGENT,
  APP_URL,
  PROGRAM_ID,
  REPO_URL,
  USDC_MINT,
  fetchDashboard,
  marketUrl,
  solscanAddr,
  solscanTx,
  type DashboardData,
} from "@/lib/solana";

const fmtUsd = (n: number | null, dp = 2) =>
  n === null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const shortAddr = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
const ago = (unixSec: number | null) => {
  if (!unixSec) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};
const endsIn = (endTs: number) => {
  const s = endTs - Math.floor(Date.now() / 1000);
  if (s <= 0) return "ended";
  if (s < 60) return `${s}s left`;
  if (s < 3600) return `${Math.floor(s / 60)}m left`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 ${className}`}>{children}</div>
  );
}

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  create: { label: "CREATE", cls: "bg-blue-500/20 text-blue-300" },
  trade: { label: "TRADE", cls: "bg-emerald-500/20 text-emerald-300" },
  resolve: { label: "RESOLVE", cls: "bg-violet-500/20 text-violet-300" },
  "claim-lp": { label: "CLAIM LP", cls: "bg-amber-500/20 text-amber-300" },
  claim: { label: "CLAIM", cls: "bg-amber-500/20 text-amber-300" },
};

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await fetchDashboard();
        if (alive) { setData(d); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message.slice(0, 160) : "Failed to load on-chain data");
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const markets = data?.markets ?? [];
  const live = markets.filter((m) => m.status === "LIVE");
  const activity = data?.activity ?? [];
  const decided = (data?.wins ?? 0) + (data?.losses ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-xl font-black">P</div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">PredictPilot</h1>
            <p className="text-sm text-white/60">Agentic Prediction Markets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-300">
            ● LIVE — Solana Devnet
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
            pm-AMM
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mt-10">
        <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          An autonomous agent that creates prediction markets — and trades its own convictions.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70">
          PredictPilot watches SOL, opens a new <span className="font-mono text-white/90">“SOL &gt; $strike?”</span> market
          on pm-AMM every hour, seeds it with liquidity, and buys YES or NO by momentum.
          When the market expires it resolves the outcome and claims the winnings — every step is a real
          transaction on Solana devnet, read live on this page.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-violet-600/20 px-3 py-1 font-semibold text-violet-300">Momentum rule: price &gt; 1h MA + rising 15m → YES</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">1h markets, 20 mUSDC LP</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">10 mUSDC per trade</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">2% swap fee</span>
        </div>
      </section>

      {error && (
        <div className="mt-8 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          Could not reach the Solana devnet RPC: {error}. Markets below may be stale — retry in a moment.
        </div>
      )}

      {/* Agent stats */}
      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-white/50">SOL now</p>
          <p className="mt-1 text-2xl font-bold">{data ? fmtUsd(data.solPrice) : "…"}</p>
          <p className="mt-1 text-xs text-white/40">CoinGecko · live</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-white/50">Agent mUSDC</p>
          <p className="mt-1 text-2xl font-bold">{data ? data.agentMusdc.toFixed(2) : "…"}</p>
          <p className="mt-1 font-mono text-xs text-white/40">{shortAddr(AGENT.toBase58())}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-white/50">Markets created</p>
          <p className="mt-1 text-2xl font-bold">{data ? markets.length : "…"}</p>
          <p className="mt-1 text-xs text-white/40">{data ? `${live.length} live right now` : "reading chain…"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-white/50">Settled calls</p>
          <p className="mt-1 text-2xl font-bold">
            {data ? `${data.wins}W – ${data.losses}L` : "…"}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {data ? `Net ${data.netMusdc >= 0 ? "+" : ""}${data.netMusdc.toFixed(2)} mUSDC · slot ${data.slot.toLocaleString()}` : "reading chain…"}
          </p>
        </Card>
      </section>

      {/* Markets */}
      <section className="mt-10">
        <h3 className="text-lg font-bold">Agent markets — live from the chain</h3>
        {markets.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-white/60">
              {data
                ? "No markets yet. The agent creates a new 1-hour SOL market on each cycle — the first one appears here as soon as it is on-chain."
                : "Loading markets…"}
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-2">
            {markets.map((m) => (
              <a key={m.pda} href={marketUrl(m.marketId)} target="_blank" rel="noreferrer"
                 className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm transition hover:border-white/25">
                <span className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    m.status === "LIVE" ? "bg-emerald-500/20 text-emerald-300"
                    : m.status === "EXPIRED" ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/10 text-white/70"
                  }`}>{m.status}</span>
                  <span className="font-bold">{m.name}</span>
                  {m.yesPrice !== null && (
                    <span className="font-mono text-white/70">YES {(m.yesPrice * 100).toFixed(1)}%</span>
                  )}
                  {m.resolved && (
                    <span className="font-mono text-white/70">
                      → {m.winningSide === 1 ? "YES won" : m.winningSide === 2 ? "NO won" : "resolved"}
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-white/40">
                  {m.status === "LIVE" ? endsIn(m.endTs) : ago(m.endTs)} · trade on pm-AMM ↗
                </span>
              </a>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-white/40">
          Markets are created by the agent wallet on the pm-AMM program. Anyone can open a market on the
          pm-AMM app and trade YES/NO against the agent’s liquidity. Prices move with the dynamic
          pm-AMM curve as traders buy and sell.
        </p>
      </section>

      {/* Activity */}
      <section className="mt-10">
        <h3 className="text-lg font-bold">Agent activity — every market, trade and claim</h3>
        {activity.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-white/60">
              {data ? "No activity logged yet." : "Loading activity…"}
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-2">
            {activity.map((a, i) => {
              const t = TYPE_LABEL[a.type] ?? { label: a.type.toUpperCase(), cls: "bg-white/10 text-white/70" };
              const body = a.note ?? `${a.type} ${a.marketId ?? ""}`;
              return (
                <a key={`${a.ts}-${i}`} href={a.sig ? solscanTx(a.sig) : "#"} target={a.sig ? "_blank" : undefined} rel="noreferrer"
                   className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm transition hover:border-white/25">
                  <span className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${t.cls}`}>{t.label}</span>
                    <span className="text-white/80">{body}</span>
                  </span>
                  <span className="font-mono text-xs text-white/40">
                    {new Date(a.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} {a.sig ? "↗" : ""}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h3 className="text-lg font-bold">How it works</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-2xl font-black text-violet-400">1</p>
            <p className="mt-2 font-bold">Watch SOL, set the strike</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">Every hour the agent fetches the live SOL price and its 1-hour moving average from public market data, then creates a “SOL &gt; $strike by next hour?” market with 20 mUSDC of liquidity.</p>
          </Card>
          <Card>
            <p className="text-2xl font-black text-violet-400">2</p>
            <p className="mt-2 font-bold">Trade the momentum signal</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">Price above the 1h average and rising over 15 minutes → buy YES 10 mUSDC. Below the average and falling → buy NO. Sideways → liquidity only, no trade. Every swap is simulated first.</p>
          </Card>
          <Card>
            <p className="text-2xl font-black text-violet-400">3</p>
            <p className="mt-2 font-bold">Resolve and claim</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">At expiry the agent compares the real SOL price to the strike, resolves the market, then claims LP residuals first and winnings second — the order the pm-AMM reference requires, or the claim strands.</p>
          </Card>
        </div>
      </section>

      {/* Contracts */}
      <section className="mt-10">
        <h3 className="text-lg font-bold">Program &amp; wallets — Solana Devnet</h3>
        <Card className="mt-4">
          <dl className="space-y-2 font-mono text-sm">
            {[
              ["pm-AMM program", PROGRAM_ID.toBase58()],
              ["mUSDC (devnet mock)", USDC_MINT.toBase58()],
              ["Agent wallet", AGENT.toBase58()],
              ["pm-AMM app", APP_URL],
              ["Source code", REPO_URL],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-white/60">{label}</span>
                {value.startsWith("http") ? (
                  <a href={value} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">{value.replace("https://", "")} ↗</a>
                ) : (
                  <a href={solscanAddr(value)} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">{shortAddr(value)} ↗</a>
                )}
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <footer className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
        <p>
          PredictPilot is a hackathon entry for the Solana Perps &amp; Prediction Markets Hackathon
          (main track + PREDICT pm-AMM bounty). Everything runs on Solana devnet with mock USDC and
          test SOL — nothing here has real value. pm-AMM is an unaudited proof-of-concept program;
          markets are resolved manually by their authority (this agent). Built by Bambang Hendri
          Susanto (Agent ID bambang7010.ai). Source and trade history are public on-chain.
        </p>
      </footer>
    </main>
  );
}
