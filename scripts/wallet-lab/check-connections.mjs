#!/usr/bin/env node
/**
 * NoblePort Wallet Lab — RPC connection prober
 *
 * Probes the candidate RPC endpoints for both legs of the dual-token
 * architecture and reports what is reachable from the current environment,
 * with latency. Read-only: sends a single cheap JSON-RPC call per endpoint.
 *
 * Usage: node scripts/wallet-lab/check-connections.mjs
 */

const ENDPOINTS = [
  // ── EVM testnets ────────────────────────────────────────────────────
  { chain: 'evm', net: 'sepolia', name: 'PublicNode Sepolia', url: 'https://ethereum-sepolia-rpc.publicnode.com', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } },
  { chain: 'evm', net: 'sepolia', name: 'rpc.sepolia.org', url: 'https://rpc.sepolia.org', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } },
  { chain: 'evm', net: 'sepolia', name: 'Ankr Sepolia', url: 'https://rpc.ankr.com/eth_sepolia', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } },
  { chain: 'evm', net: 'arb-sepolia', name: 'Arbitrum Sepolia (official)', url: 'https://sepolia-rollup.arbitrum.io/rpc', body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } },
  // Provider-keyed endpoints — set env vars to test with your own keys.
  ...(process.env.ALCHEMY_KEY ? [{ chain: 'evm', net: 'sepolia', name: 'Alchemy Sepolia (keyed)', url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`, body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } }] : []),
  ...(process.env.INFURA_KEY ? [{ chain: 'evm', net: 'sepolia', name: 'Infura Sepolia (keyed)', url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`, body: { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] } }] : []),

  // ── Solana ──────────────────────────────────────────────────────────
  { chain: 'solana', net: 'devnet', name: 'Solana devnet (official)', url: 'https://api.devnet.solana.com', body: { jsonrpc: '2.0', id: 1, method: 'getHealth' } },
  { chain: 'solana', net: 'mainnet', name: 'Solana mainnet (official)', url: 'https://api.mainnet-beta.solana.com', body: { jsonrpc: '2.0', id: 1, method: 'getHealth' } },
  ...(process.env.HELIUS_KEY ? [{ chain: 'solana', net: 'mainnet', name: 'Helius (keyed)', url: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`, body: { jsonrpc: '2.0', id: 1, method: 'getHealth' } }] : []),
];

async function probe(ep) {
  const t0 = Date.now();
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ep.body),
      signal: AbortSignal.timeout(8000),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    let detail = `HTTP ${res.status}`;
    if (res.ok) {
      try {
        const json = JSON.parse(text);
        detail = json.result !== undefined ? `ok · result=${JSON.stringify(json.result).slice(0, 24)}` : `rpc error: ${json.error?.message ?? 'unknown'}`;
      } catch { detail = 'ok · non-JSON body'; }
    } else if (text.includes('not in allowlist')) {
      detail = 'BLOCKED by environment egress allowlist';
    }
    return { ...ep, ok: res.ok, ms, detail };
  } catch (err) {
    return { ...ep, ok: false, ms: Date.now() - t0, detail: `error: ${err.name === 'TimeoutError' ? 'timeout' : err.message}` };
  }
}

const results = await Promise.all(ENDPOINTS.map(probe));
console.log('\nNoblePort Wallet Lab — connection report\n');
for (const r of results) {
  const flag = r.ok ? 'PASS' : 'FAIL';
  console.log(`  ${flag}  [${r.chain}/${r.net}]  ${r.name.padEnd(28)} ${String(r.ms).padStart(5)}ms  ${r.detail}`);
}

const blocked = results.filter((r) => r.detail.includes('allowlist'));
if (blocked.length) {
  console.log('\nHosts to add to the environment network allowlist:');
  for (const host of new Set(blocked.map((r) => new URL(r.url).host))) console.log(`  ${host}`);
}
const best = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
if (best.length) {
  console.log(`\nFastest working endpoint per chain:`);
  for (const chain of ['evm', 'solana']) {
    const top = best.find((r) => r.chain === chain);
    if (top) console.log(`  ${chain}: ${top.name} (${top.ms}ms)`);
  }
}
console.log();
