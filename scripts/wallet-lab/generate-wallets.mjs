#!/usr/bin/env node
/**
 * NoblePort Wallet Lab — test wallet generator (TESTNET/DEVNET ONLY)
 *
 * Generates throwaway EVM (secp256k1, via ethers) and Solana (ed25519, via
 * node:crypto) keypairs for connection testing. Private material is written
 * to .wallets.local.json in this directory, which is gitignored — NEVER
 * commit it, and never fund these wallets with real assets.
 *
 * Usage: node scripts/wallet-lab/generate-wallets.mjs [count]
 */
import { Wallet } from 'ethers';
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) {
  let n = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of buf) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out;
}

function solanaKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  // Raw 32-byte values live at the tail of the DER export.
  const pub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  // Solana convention: 64-byte secret = seed || pubkey.
  const secret64 = Buffer.concat([priv, pub]);
  return { address: base58(pub), secretBase58: base58(secret64) };
}

const count = Math.max(1, Math.min(10, parseInt(process.argv[2] ?? '2', 10) || 2));
const wallets = { generatedAt: new Date().toISOString(), warning: 'TEST WALLETS ONLY — never fund with real assets, never commit', evm: [], solana: [] };

for (let i = 0; i < count; i++) {
  const w = Wallet.createRandom();
  wallets.evm.push({ label: `evm-test-${i + 1}`, address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase ?? null });
  const s = solanaKeypair();
  wallets.solana.push({ label: `sol-test-${i + 1}`, address: s.address, secretBase58: s.secretBase58 });
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), '.wallets.local.json');
writeFileSync(outPath, JSON.stringify(wallets, null, 2), { mode: 0o600 });

console.log(`Wrote private material to ${outPath} (gitignored, mode 600)\n`);
console.log('PUBLIC addresses (safe to share):\n');
for (const w of wallets.evm) console.log(`  ${w.label}  ${w.address}`);
for (const s of wallets.solana) console.log(`  ${s.label}  ${s.address}`);
console.log(`
Faucets (testnet funds):
  Sepolia ETH        https://sepoliafaucet.com  ·  https://faucet.quicknode.com/ethereum/sepolia
  Arbitrum Sepolia   https://faucet.quicknode.com/arbitrum/sepolia
  Solana devnet      solana airdrop 2 <address> --url devnet  ·  https://faucet.solana.com
`);
