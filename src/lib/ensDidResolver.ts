/**
 * ENS DID Resolver for NoblePort SSI
 *
 * Connects NoblePort SSI to ENS-based DID resolution for names like
 * `nobleport.eth` or `did:ens:nobleport.eth`
 *
 * Uses the ens-did-resolver + did-resolver stack for full DID Document resolution
 *
 * @see https://github.com/veramolabs/ens-did-resolver
 * @see https://github.com/veramolabs/did-ens-spec
 */

import { getResolver as getEnsDidResolver } from 'ens-did-resolver';
import { Resolver, DIDDocument } from 'did-resolver';
import { ethers } from 'ethers';

// Ethereum RPC provider configuration
// Supports Infura, Alchemy, or any Ethereum RPC provider
const INFURA_PROJECT_ID = process.env.NEXT_PUBLIC_INFURA_ID || process.env.INFURA_PROJECT_ID || '';

/**
 * DID Resolver instance configured for ENS resolution
 * Handles did:ens:* DIDs like did:ens:nobleport.eth
 */
export const didResolver = new Resolver({
  ...getEnsDidResolver({
    infuraProjectId: INFURA_PROJECT_ID,
    // Network defaults to mainnet; can be 'sepolia' for testing
    // network: 'mainnet',
  }),
});

/**
 * Resolve an ENS-based DID to its DID Document
 *
 * @param did - The DID to resolve (e.g., 'did:ens:nobleport.eth')
 * @returns The resolved DID Document or null if not found
 *
 * @example
 * const doc = await resolveEnsDid('did:ens:nobleport.eth');
 * console.log(doc.verificationMethod);
 */
export async function resolveEnsDid(did: string): Promise<DIDDocument | null> {
  const result = await didResolver.resolve(did);
  return result.didDocument;
}

/**
 * Convert an ENS name to its canonical DID format
 *
 * @param ensName - The ENS name (e.g., 'nobleport.eth')
 * @returns The canonical DID (e.g., 'did:ens:nobleport.eth')
 */
export function ensNameToDid(ensName: string): string {
  // Remove any existing did:ens: prefix to prevent duplication
  const cleanName = ensName.replace(/^did:ens:/, '');
  return `did:ens:${cleanName}`;
}

/**
 * Check if a string is a valid ENS DID
 *
 * @param did - The string to check
 * @returns True if the string is a valid did:ens DID
 */
export function isEnsDid(did: string): boolean {
  return did.startsWith('did:ens:') && did.endsWith('.eth');
}

// ============================================================================
// Direct ENS Resolution (non-DID, address-only)
// ============================================================================

/**
 * Create an Ethereum provider for direct ENS resolution
 */
function createProvider(): ethers.JsonRpcProvider {
  if (!INFURA_PROJECT_ID) {
    throw new Error('INFURA_PROJECT_ID is required for ENS resolution');
  }
  return new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`);
}

/**
 * Resolve an ENS name directly to an Ethereum address
 *
 * Use this when you only need the address, not the full DID Document.
 * For SSI integration, prefer resolveEnsDid() instead.
 *
 * @param name - The ENS name to resolve (e.g., 'nobleport.eth')
 * @returns The Ethereum address or null if not found
 *
 * @example
 * const addr = await resolveEnsAddress('nobleport.eth');
 * // Returns '0x...' or null
 */
export async function resolveEnsAddress(name: string): Promise<string | null> {
  const provider = createProvider();
  const addr = await provider.resolveName(name);
  return addr;
}

/**
 * Reverse resolve an Ethereum address to an ENS name
 *
 * @param address - The Ethereum address to look up
 * @returns The ENS name or null if not set
 *
 * @example
 * const name = await reverseResolveEns('0x...');
 * // Returns 'nobleport.eth' or null
 */
export async function reverseResolveEns(address: string): Promise<string | null> {
  const provider = createProvider();
  const name = await provider.lookupAddress(address);
  return name;
}

/**
 * Get ENS text records for a name
 *
 * @param name - The ENS name
 * @param keys - The text record keys to fetch
 * @returns Object mapping keys to their values
 *
 * @example
 * const records = await getEnsTextRecords('nobleport.eth', ['url', 'email', 'description']);
 */
export async function getEnsTextRecords(
  name: string,
  keys: string[]
): Promise<Record<string, string | null>> {
  const provider = createProvider();
  const resolver = await provider.getResolver(name);

  if (!resolver) {
    return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
  }

  const records: Record<string, string | null> = {};

  for (const key of keys) {
    try {
      records[key] = await resolver.getText(key);
    } catch {
      records[key] = null;
    }
  }

  return records;
}

// ============================================================================
// NoblePort-specific helpers
// ============================================================================

/**
 * NoblePort root ENS identifiers
 */
export const NOBLEPORT_ENS = {
  ROOT: 'nobleport.eth',
  ROOT_DID: 'did:ens:nobleport.eth',
  ETF: 'etf.nobleport.eth',
  ETF_DID: 'did:ens:etf.nobleport.eth',
} as const;

/**
 * Resolve the NoblePort root DID Document
 *
 * @returns The NoblePort root DID Document
 */
export async function resolveNoblePortRootDid(): Promise<DIDDocument | null> {
  return resolveEnsDid(NOBLEPORT_ENS.ROOT_DID);
}

/**
 * Resolve the NoblePort ETF DID Document
 *
 * @returns The NoblePort ETF DID Document
 */
export async function resolveNoblePortEtfDid(): Promise<DIDDocument | null> {
  return resolveEnsDid(NOBLEPORT_ENS.ETF_DID);
}
