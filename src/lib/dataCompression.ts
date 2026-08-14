/**
 * NoblePort Data Compression & Optimization Module
 *
 * High-performance data packet compression for reduced latency
 * and efficient network transmission across NoblePort.eth ecosystem
 *
 * @module dataCompression
 * @version 2.0.0
 * @optimized true
 */

// ============================================================================
// COMPRESSION CONSTANTS & LOOKUP TABLES
// ============================================================================

/** Byte-level compression lookup for common patterns */
const COMPRESSION_LUT: Record<string, string> = {
  'nobleport.eth': 'NP',
  'did:ens:': 'DE:',
  'stephanie': 'ST',
  'portfolio': 'PF',
  'operations': 'OP',
  'compliance': 'CP',
  'governance': 'GV',
  'investors': 'IV',
  'holdings': 'HD',
  'custodian': 'CU',
  'bookkeeper': 'BK',
  'oracle': 'OR',
  'identity': 'ID',
  'authentication': 'AU',
  'verification': 'VR',
  'capabilities': 'CB',
  'mcp://api': 'M:',
  'connected': 'C1',
  'disconnected': 'C0',
  'active': 'A1',
  'pending': 'P1',
  'healthy': 'H1',
  'unhealthy': 'H0'
};

/** Reverse lookup for decompression */
const DECOMPRESSION_LUT: Record<string, string> = Object.fromEntries(
  Object.entries(COMPRESSION_LUT).map(([k, v]) => [v, k])
);

// ============================================================================
// COMPRESSED DATA PACKET TYPES
// ============================================================================

export interface CompressedPacket<T = unknown> {
  /** Packet version identifier */
  v: number;
  /** Timestamp (Unix ms) */
  t: number;
  /** Compression ratio achieved */
  r: number;
  /** Original size in bytes */
  os: number;
  /** Compressed size in bytes */
  cs: number;
  /** Checksum for integrity */
  ck: string;
  /** Compressed payload */
  p: T;
}

export interface OptimizedModule {
  /** Module ID (compressed) */
  m: string;
  /** ENS name (compressed) */
  e: string;
  /** DID (compressed) */
  d: string;
  /** Status code */
  s: number;
  /** Capabilities (bitmap) */
  c: number;
  /** Last sync (Unix) */
  ls: number;
}

export interface OptimizedPlatform {
  /** Platform ID */
  id: string;
  /** Provider code */
  pv: number;
  /** Protocol code */
  pr: number;
  /** Endpoint (compressed) */
  ep: string;
  /** Status */
  st: number;
  /** Capabilities (bitmap) */
  cb: number;
  /** Rate limit (req/min) */
  rl: number;
  /** Token limit */
  tl: number;
}

export interface OptimizedNetworkState {
  /** Root identity hash */
  ri: string;
  /** Module states (compressed array) */
  ms: OptimizedModule[];
  /** Platform states (compressed array) */
  ps: OptimizedPlatform[];
  /** Health bitmap */
  hb: number;
  /** Timestamp */
  ts: number;
}

// ============================================================================
// PROVIDER & PROTOCOL ENCODING
// ============================================================================

const PROVIDER_CODES: Record<string, number> = {
  'Anthropic': 1, 'OpenAI': 2, 'xAI': 3, 'Google': 4,
  'Meta': 5, 'Replit': 6, 'Mistral': 7, 'Cohere': 8,
  'Perplexity': 9, 'Hugging Face': 10, 'Together': 11,
  'Groq': 12, 'DeepSeek': 13
};

const PROTOCOL_CODES: Record<string, number> = {
  'mcp': 1, 'rest': 2, 'graphql': 3, 'websocket': 4
};

const STATUS_CODES: Record<string, number> = {
  'active': 1, 'connected': 1, 'healthy': 1,
  'pending': 2, 'degraded': 2,
  'disabled': 0, 'disconnected': 0, 'unhealthy': 0
};

// ============================================================================
// CAPABILITY BITMAP ENCODING
// ============================================================================

const CAPABILITY_BITS: Record<string, number> = {
  // AI Capabilities (bits 0-15)
  'code-generation': 1 << 0,
  'document-analysis': 1 << 1,
  'portfolio-insights': 1 << 2,
  'compliance-review': 1 << 3,
  'natural-language-processing': 1 << 4,
  'multi-modal-analysis': 1 << 5,
  'agentic-workflows': 1 << 6,
  'conversational-ai': 1 << 7,
  'code-interpreter': 1 << 8,
  'data-analysis': 1 << 9,
  'function-calling': 1 << 10,
  'vision-analysis': 1 << 11,
  'real-time-data': 1 << 12,
  'market-analysis': 1 << 13,
  'trend-prediction': 1 << 14,
  'research-synthesis': 1 << 15,

  // Module Capabilities (bits 16-31)
  'asset-valuation': 1 << 16,
  'rebalancing': 1 << 17,
  'risk-assessment': 1 << 18,
  'performance-tracking': 1 << 19,
  'health-monitoring': 1 << 20,
  'anomaly-detection': 1 << 21,
  'alert-management': 1 << 22,
  'audit-trails': 1 << 23,
  'regulatory-filing': 1 << 24,
  'kyc-aml': 1 << 25,
  'voting': 1 << 26,
  'staking': 1 << 27,
  'did-resolution': 1 << 28,
  'credential-verification': 1 << 29,
  'authentication': 1 << 30,
  'authorization': 1 << 31
};

// ============================================================================
// COMPRESSION FUNCTIONS
// ============================================================================

/**
 * Compress a string using the lookup table
 */
export function compressString(input: string): string {
  let result = input;
  for (const [pattern, replacement] of Object.entries(COMPRESSION_LUT)) {
    result = result.replace(new RegExp(pattern, 'g'), replacement);
  }
  return result;
}

/**
 * Decompress a string using the reverse lookup table
 */
export function decompressString(input: string): string {
  let result = input;
  for (const [pattern, replacement] of Object.entries(DECOMPRESSION_LUT)) {
    result = result.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  }
  return result;
}

/**
 * Encode capabilities array to bitmap
 */
export function encodeCapabilities(capabilities: string[]): number {
  return capabilities.reduce((bitmap, cap) => {
    return bitmap | (CAPABILITY_BITS[cap] || 0);
  }, 0);
}

/**
 * Decode bitmap to capabilities array
 */
export function decodeCapabilities(bitmap: number): string[] {
  return Object.entries(CAPABILITY_BITS)
    .filter(([, bit]) => (bitmap & bit) !== 0)
    .map(([cap]) => cap);
}

/**
 * Calculate simple checksum for data integrity
 */
export function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create a compressed data packet
 */
export function createCompressedPacket<T>(
  data: T,
  originalSize?: number
): CompressedPacket<T> {
  const jsonStr = JSON.stringify(data);
  const compressedStr = compressString(jsonStr);
  const os = originalSize || new Blob([JSON.stringify(data)]).size;
  const cs = new Blob([compressedStr]).size;

  return {
    v: 2,
    t: Date.now(),
    r: Number((os / cs).toFixed(2)),
    os,
    cs,
    ck: calculateChecksum(compressedStr),
    p: data
  };
}

// ============================================================================
// OPTIMIZED DATA TRANSFORMERS
// ============================================================================

/**
 * Compress module connection to optimized format
 */
export function compressModule(module: {
  module: string;
  ens: string;
  did: string;
  status: string;
  lastSync?: Date;
  capabilities: string[];
}): OptimizedModule {
  return {
    m: compressString(module.module),
    e: compressString(module.ens),
    d: compressString(module.did),
    s: STATUS_CODES[module.status] ?? 2,
    c: encodeCapabilities(module.capabilities),
    ls: module.lastSync ? module.lastSync.getTime() : 0
  };
}

/**
 * Decompress optimized module to full format
 */
export function decompressModule(opt: OptimizedModule): {
  module: string;
  ens: string;
  did: string;
  status: string;
  lastSync: Date | null;
  capabilities: string[];
} {
  const statusMap: Record<number, string> = { 1: 'connected', 2: 'pending', 0: 'disconnected' };
  return {
    module: decompressString(opt.m),
    ens: decompressString(opt.e),
    did: decompressString(opt.d),
    status: statusMap[opt.s] || 'pending',
    lastSync: opt.ls > 0 ? new Date(opt.ls) : null,
    capabilities: decodeCapabilities(opt.c)
  };
}

/**
 * Compress platform connection to optimized format
 */
export function compressPlatform(platform: {
  id: string;
  provider: string;
  protocol: string;
  endpoint: string;
  status: string;
  capabilities: string[];
  rateLimits?: { requestsPerMinute: number; tokensPerRequest: number };
}): OptimizedPlatform {
  return {
    id: platform.id,
    pv: PROVIDER_CODES[platform.provider] ?? 0,
    pr: PROTOCOL_CODES[platform.protocol] ?? 1,
    ep: compressString(platform.endpoint),
    st: STATUS_CODES[platform.status] ?? 2,
    cb: encodeCapabilities(platform.capabilities),
    rl: platform.rateLimits?.requestsPerMinute ?? 0,
    tl: platform.rateLimits?.tokensPerRequest ?? 0
  };
}

/**
 * Decompress optimized platform to full format
 */
export function decompressPlatform(opt: OptimizedPlatform): {
  id: string;
  provider: string;
  protocol: string;
  endpoint: string;
  status: string;
  capabilities: string[];
  rateLimits: { requestsPerMinute: number; tokensPerRequest: number } | null;
} {
  const providerMap = Object.fromEntries(
    Object.entries(PROVIDER_CODES).map(([k, v]) => [v, k])
  );
  const protocolMap = Object.fromEntries(
    Object.entries(PROTOCOL_CODES).map(([k, v]) => [v, k])
  );
  const statusMap: Record<number, string> = { 1: 'active', 2: 'pending', 0: 'disabled' };

  return {
    id: opt.id,
    provider: providerMap[opt.pv] || 'Unknown',
    protocol: protocolMap[opt.pr] || 'mcp',
    endpoint: decompressString(opt.ep),
    status: statusMap[opt.st] || 'pending',
    capabilities: decodeCapabilities(opt.cb),
    rateLimits: opt.rl > 0 ? {
      requestsPerMinute: opt.rl,
      tokensPerRequest: opt.tl
    } : null
  };
}

// ============================================================================
// NETWORK STATE COMPRESSION
// ============================================================================

/**
 * Compress entire network state for efficient transmission
 */
export function compressNetworkState(state: {
  modules: Array<{
    module: string;
    ens: string;
    did: string;
    status: string;
    lastSync?: Date;
    capabilities: string[];
  }>;
  platforms: Array<{
    id: string;
    provider: string;
    protocol: string;
    endpoint: string;
    status: string;
    capabilities: string[];
    rateLimits?: { requestsPerMinute: number; tokensPerRequest: number };
  }>;
  healthStatus?: string;
}): CompressedPacket<OptimizedNetworkState> {
  // Calculate original size
  const originalJson = JSON.stringify(state);
  const originalSize = new Blob([originalJson]).size;

  // Build health bitmap
  let healthBitmap = 0;
  state.modules.forEach((m, i) => {
    if (m.status === 'connected') healthBitmap |= (1 << i);
  });
  state.platforms.forEach((p, i) => {
    if (p.status === 'active') healthBitmap |= (1 << (16 + i));
  });

  const optimized: OptimizedNetworkState = {
    ri: calculateChecksum('nobleport.eth'),
    ms: state.modules.map(compressModule),
    ps: state.platforms.map(compressPlatform),
    hb: healthBitmap,
    ts: Date.now()
  };

  return createCompressedPacket(optimized, originalSize);
}

/**
 * Decompress network state packet
 */
export function decompressNetworkState(packet: CompressedPacket<OptimizedNetworkState>): {
  modules: Array<{
    module: string;
    ens: string;
    did: string;
    status: string;
    lastSync: Date | null;
    capabilities: string[];
  }>;
  platforms: Array<{
    id: string;
    provider: string;
    protocol: string;
    endpoint: string;
    status: string;
    capabilities: string[];
    rateLimits: { requestsPerMinute: number; tokensPerRequest: number } | null;
  }>;
  timestamp: Date;
  compressionRatio: number;
} {
  return {
    modules: packet.p.ms.map(decompressModule),
    platforms: packet.p.ps.map(decompressPlatform),
    timestamp: new Date(packet.p.ts),
    compressionRatio: packet.r
  };
}

// ============================================================================
// DELTA COMPRESSION FOR REAL-TIME UPDATES
// ============================================================================

export interface DeltaPacket {
  /** Packet type: 'full' | 'delta' */
  type: 'F' | 'D';
  /** Base state hash (for delta) */
  base?: string;
  /** Changed module indices */
  cm?: number[];
  /** Changed platform indices */
  cp?: number[];
  /** Updated modules (sparse) */
  um?: Record<number, Partial<OptimizedModule>>;
  /** Updated platforms (sparse) */
  up?: Record<number, Partial<OptimizedPlatform>>;
  /** Timestamp */
  ts: number;
}

/**
 * Create a delta packet for incremental updates
 */
export function createDeltaPacket(
  previousState: OptimizedNetworkState | null,
  currentState: OptimizedNetworkState
): DeltaPacket {
  if (!previousState) {
    return { type: 'F', ts: Date.now() };
  }

  const changedModules: number[] = [];
  const changedPlatforms: number[] = [];
  const updatedModules: Record<number, Partial<OptimizedModule>> = {};
  const updatedPlatforms: Record<number, Partial<OptimizedPlatform>> = {};

  // Detect module changes
  currentState.ms.forEach((m, i) => {
    const prev = previousState.ms[i];
    if (!prev || m.s !== prev.s || m.ls !== prev.ls) {
      changedModules.push(i);
      updatedModules[i] = { s: m.s, ls: m.ls };
    }
  });

  // Detect platform changes
  currentState.ps.forEach((p, i) => {
    const prev = previousState.ps[i];
    if (!prev || p.st !== prev.st) {
      changedPlatforms.push(i);
      updatedPlatforms[i] = { st: p.st };
    }
  });

  return {
    type: 'D',
    base: previousState.ri,
    cm: changedModules.length > 0 ? changedModules : undefined,
    cp: changedPlatforms.length > 0 ? changedPlatforms : undefined,
    um: Object.keys(updatedModules).length > 0 ? updatedModules : undefined,
    up: Object.keys(updatedPlatforms).length > 0 ? updatedPlatforms : undefined,
    ts: Date.now()
  };
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface CompressionMetrics {
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  compressionTimeMs: number;
  decompressionTimeMs: number;
  throughputMBps: number;
}

/**
 * Benchmark compression performance
 */
export function benchmarkCompression<T>(data: T): CompressionMetrics {
  const original = JSON.stringify(data);
  const originalBytes = new Blob([original]).size;

  // Compression benchmark
  const compressStart = performance.now();
  const compressed = compressString(original);
  const compressEnd = performance.now();

  const compressedBytes = new Blob([compressed]).size;

  // Decompression benchmark
  const decompressStart = performance.now();
  decompressString(compressed);
  const decompressEnd = performance.now();

  const compressionTimeMs = compressEnd - compressStart;
  const decompressionTimeMs = decompressEnd - decompressStart;

  // Calculate throughput (MB/s)
  const throughputMBps = (originalBytes / 1024 / 1024) / (compressionTimeMs / 1000);

  return {
    originalBytes,
    compressedBytes,
    compressionRatio: Number((originalBytes / compressedBytes).toFixed(2)),
    compressionTimeMs: Number(compressionTimeMs.toFixed(3)),
    decompressionTimeMs: Number(decompressionTimeMs.toFixed(3)),
    throughputMBps: Number(throughputMBps.toFixed(2))
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  compressString,
  decompressString,
  encodeCapabilities,
  decodeCapabilities,
  createCompressedPacket,
  compressModule,
  decompressModule,
  compressPlatform,
  decompressPlatform,
  compressNetworkState,
  decompressNetworkState,
  createDeltaPacket,
  benchmarkCompression,
  COMPRESSION_LUT,
  CAPABILITY_BITS,
  PROVIDER_CODES,
  PROTOCOL_CODES,
  STATUS_CODES
};
