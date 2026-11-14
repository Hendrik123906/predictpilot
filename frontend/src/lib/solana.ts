// PredictPilot — live on-chain reads for the dashboard (Solana devnet).
// Everything here is a read-only call to the public devnet RPC. No wallet needed.
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { PmAmmClient, decodeName, type MarketAccount } from "@pm-amm/sdk";
import { i80f48ToNumber, priceFromReserves } from "@pm-amm/sdk/math";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const RPC_URL = "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");
export const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ"); // devnet mUSDC
export const AGENT = new PublicKey("5hkydCE14hV7SzhFyuAsWPpmkguv1Pk4VqKR7dBFTRcz");
export const APP_URL = "https://pm-amm-devnet.vercel.app";
export const REPO_URL = "https://github.com/Hendrik123906/predictpilot";

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}?cluster=devnet`;
export const solscanAddr = (a: string) => `https://solscan.io/account/${a}?cluster=devnet`;
export const marketUrl = (id: string | number) => `${APP_URL}/market/${id}`;

// Same dynamic-pricing math as the agent (see predictpilot.cjs).
export function marketState(m: MarketAccount) {
  const now = Math.floor(Date.now() / 1000);
  const endTs = m.endTs.toNumber();
  const lZero = i80f48ToNumber(m.lZero);
  const lEff = lZero * Math.sqrt(Math.max(endTs - now, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - m.lastAccrualTs.toNumber(), 1));
  const x = i80f48ToNumber(m.reserveYes) * (lEff / lLast);
  const y = i80f48ToNumber(m.reserveNo) * (lEff / lLast);
  return { x, y, lEff, price: priceFromReserves(x, y, lEff) };
}

export type MarketLive = {
  pda: string;
  marketId: string;
  name: string;
  strike: number | null;
  endTs: number;
  resolved: boolean;
  winningSide: number; // 0 = none/unresolved, 1 = YES, 2 = NO
  yesPrice: number | null; // 0..1 while live
  status: "LIVE" | "EXPIRED" | "RESOLVED";
};

export type ActivityEntry = {
  ts: string;
  type: string;
  market?: string;
  marketId?: string;
  name?: string;
  side?: string;
  amount?: number;
  outcome?: string;
  priceAtExpiry?: number;
  strike?: number;
  depositUsdc?: number;
  sig?: string;
  note?: string;
};

export type LoggedMarket = {
  pda: string;
  marketId: string;
  name: string;
  symbol: string;
  strike: number;
  endTs: number;
  createdAt: string;
  depositUsdc: number;
  tradeSide?: string;
  tradeAmount?: number;
  settled?: { outcome: string; priceAtExpiry: number; claimSig: string; resolveSig: string };
};

export type DashboardData = {
  fetchedAt: number;
  slot: number;
  agentSol: number;
  agentMusdc: number;
  solPrice: number | null;
  markets: MarketLive[];
  activity: ActivityEntry[];
  logged: LoggedMarket[];
  wins: number;
  losses: number;
  netMusdc: number; // claimed winnings - (deposits + trades), mock USDC
};

function basePrefix(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.startsWith("/predictpilot") ? "/predictpilot" : "";
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${basePrefix()}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchDashboard(): Promise<DashboardData> {
  const conn = new Connection(RPC_URL, "confirmed");
  const client = PmAmmClient.readOnly(conn, PROGRAM_ID, USDC_MINT);

  const [slot, agentSolLamports, allMarkets, solPriceRes, activity, logged] = await Promise.all([
    conn.getSlot("confirmed"),
    conn.getBalance(AGENT, "confirmed"),
    client.fetchAllMarkets().catch(() => [] as { publicKey: PublicKey; account: MarketAccount }[]),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
      .then((r) => r.json())
      .catch(() => null),
    fetchJson<ActivityEntry[]>("/activity.json"),
    fetchJson<LoggedMarket[]>("/markets.json"),
  ]);

  let agentMusdc = 0;
  try {
    const ata = getAssociatedTokenAddressSync(USDC_MINT, AGENT);
    const bal = await conn.getTokenAccountBalance(ata, "confirmed");
    agentMusdc = bal.value.uiAmount ?? 0;
  } catch {
    agentMusdc = 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const markets: MarketLive[] = allMarkets
    .filter((m) => m.account.authority.equals(AGENT))
    .map((m) => {
      const a = m.account;
      const endTs = a.endTs.toNumber();
      const name = decodeName(a.name) || `Market ${a.marketId.toString()}`;
      const strikeMatch = name.match(/\$([\d.]+)/);
      const status: MarketLive["status"] = a.resolved ? "RESOLVED" : endTs <= now ? "EXPIRED" : "LIVE";
      return {
        pda: m.publicKey.toBase58(),
        marketId: a.marketId.toString(),
        name,
        strike: strikeMatch ? Number(strikeMatch[1]) : null,
        endTs,
        resolved: a.resolved,
        winningSide: a.winningSide,
        yesPrice: status === "LIVE" ? marketState(a).price : null,
        status,
      };
    })
    .sort((a, b) => b.endTs - a.endTs);

  const settled = (logged ?? []).filter((m) => m.settled);
  const wins = settled.filter((m) => m.settled!.outcome === m.tradeSide).length;
  const losses = settled.length - wins;
  const claimed = (activity ?? [])
    .filter((e) => e.type === "claim" && typeof e.amount === "number")
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  const spent = (logged ?? []).reduce(
    (s, m) => s + m.depositUsdc + (m.tradeAmount ?? 0),
    0
  );

  return {
    fetchedAt: Date.now(),
    slot,
    agentSol: agentSolLamports / LAMPORTS_PER_SOL,
    agentMusdc,
    solPrice: solPriceRes?.solana?.usd ?? null,
    markets,
    activity: (activity ?? []).slice().reverse().slice(0, 20),
    logged: logged ?? [],
    wins,
    losses,
    netMusdc: claimed - spent,
  };
}
