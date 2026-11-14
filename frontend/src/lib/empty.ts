// Empty shim for Node-only modules (e.g. `fs`) that @anchor-lang/core
// requires in a code path the browser never executes (wallet from ANCHOR_WALLET).
// Turbopack needs an explicit alias; webpack would use resolve.fallback.fs = false.
export {};
