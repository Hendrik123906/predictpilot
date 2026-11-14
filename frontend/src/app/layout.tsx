import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PredictPilot — Agentic Prediction Markets on Solana",
  description:
    "An autonomous agent creating SOL price prediction markets on pm-AMM (Solana devnet) and trading YES/NO by momentum. Live on-chain markets, prices and trade history.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
