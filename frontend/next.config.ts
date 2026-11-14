import type { NextConfig } from "next";

// Static export so the demo can be hosted on any static host (GitHub Pages).
// For a GitHub Pages project site, build with PAGES_BASE_PATH=/foreman-near.
// Tailwind v4 is wired through the Turbopack loader rule (same as rozgar-ai).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: process.env.PAGES_BASE_PATH || "",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    // @anchor-lang/core requires `fs` in a Node-only code path the browser
    // never runs (wallet from ANCHOR_WALLET). Alias it to an empty shim so
    // Turbopack can resolve the import.
    resolveAlias: {
      fs: "./src/lib/empty.ts",
    },
  },
};

export default nextConfig;
