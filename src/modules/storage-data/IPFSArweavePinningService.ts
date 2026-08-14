/**
 * Module 16 — IPFS/Arweave Pinning Service
 * Dual-pin with Pinata hot + Arweave cold for permanence
 */

export interface PinResult {
  cid: string;
  size: number;
  pinataPin: boolean;
  arweaveId: string | null;
  timestamp: number;
}

export interface PinStatus {
  cid: string;
  pinataPinned: boolean;
  arweaveStored: boolean;
  arweaveConfirmations: number;
  createdAt: number;
}

export interface PinningConfig {
  pinataApiKey: string;
  pinataEndpoint: string;
  arweaveWalletPath: string;
  arweaveEndpoint: string;
  dualPinEnabled: boolean;
  maxFileSizeMB: number;
}

export class IPFSArweavePinningService {
  private config: PinningConfig;
  private pinIndex = new Map<string, PinStatus>();

  constructor(config: PinningConfig) {
    this.config = config;
  }

  async pinData(data: Uint8Array, metadata?: Record<string, string>): Promise<PinResult> {
    // Stage 1: Pin to IPFS via Pinata (hot storage)
    const cid = await this.pinToPinata(data, metadata);

    // Stage 2: Archive to Arweave (cold/permanent storage)
    let arweaveId: string | null = null;
    if (this.config.dualPinEnabled) {
      arweaveId = await this.storeToArweave(data, cid, metadata);
    }

    const result: PinResult = {
      cid,
      size: data.length,
      pinataPin: true,
      arweaveId,
      timestamp: Date.now(),
    };

    this.pinIndex.set(cid, {
      cid,
      pinataPinned: true,
      arweaveStored: !!arweaveId,
      arweaveConfirmations: 0,
      createdAt: Date.now(),
    });

    return result;
  }

  async pinJSON(json: unknown, metadata?: Record<string, string>): Promise<PinResult> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(json));
    return this.pinData(data, metadata);
  }

  async getPinStatus(cid: string): Promise<PinStatus | undefined> {
    return this.pinIndex.get(cid);
  }

  async unpinFromPinata(cid: string): Promise<boolean> {
    const status = this.pinIndex.get(cid);
    if (!status) return false;
    status.pinataPinned = false;
    return true;
  }

  private async pinToPinata(data: Uint8Array, metadata?: Record<string, string>): Promise<string> {
    // In production: POST to Pinata API
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return `bafybeig${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 44)}`;
  }

  private async storeToArweave(
    data: Uint8Array,
    cid: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    // In production: create Arweave transaction and post
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 43);
  }
}
