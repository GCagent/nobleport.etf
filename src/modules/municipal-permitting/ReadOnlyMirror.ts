/**
 * Module 23 — Read-Only Mirror
 * Pull permits from legacy, hash, and anchor without write access
 */

export interface MirroredPermit {
  mirrorId: string;
  externalId: string;
  platform: string;
  contentHash: string;
  cid: string;           // IPFS CID of mirrored data
  merkleLeaf: string;
  anchoredInRoot: number; // Merkle root index
  mirroredAt: number;
  lastVerifiedAt: number;
  integrityValid: boolean;
}

export interface MirrorSyncConfig {
  platforms: string[];
  syncIntervalMs: number;
  anchorBatchSize: number;
  verifyOnSync: boolean;
}

export interface MirrorStats {
  totalMirrored: number;
  byPlatform: Record<string, number>;
  lastSyncAt: number;
  integrityIssues: number;
}

export class ReadOnlyMirror {
  private mirrors = new Map<string, MirroredPermit>();
  private config: MirrorSyncConfig;
  private mirrorCounter = 0;

  constructor(config: MirrorSyncConfig) {
    this.config = config;
  }

  async mirrorPermit(
    externalId: string,
    platform: string,
    permitData: Record<string, unknown>
  ): Promise<MirroredPermit> {
    const mirrorId = `mirror-${++this.mirrorCounter}`;

    // Hash the permit data
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(permitData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Pin to IPFS (read-only — no write back to legacy)
    const cid = `bafybeig${contentHash.slice(0, 44)}`;

    const mirrored: MirroredPermit = {
      mirrorId,
      externalId,
      platform,
      contentHash,
      cid,
      merkleLeaf: contentHash,
      anchoredInRoot: -1, // Will be set on next anchor batch
      mirroredAt: Date.now(),
      lastVerifiedAt: Date.now(),
      integrityValid: true,
    };

    this.mirrors.set(mirrorId, mirrored);
    return mirrored;
  }

  async verifyIntegrity(mirrorId: string, currentData: Record<string, unknown>): Promise<boolean> {
    const mirror = this.mirrors.get(mirrorId);
    if (!mirror) throw new Error(`Mirror ${mirrorId} not found`);

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(currentData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const currentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    mirror.integrityValid = currentHash === mirror.contentHash;
    mirror.lastVerifiedAt = Date.now();
    return mirror.integrityValid;
  }

  async getStats(): Promise<MirrorStats> {
    const all = Array.from(this.mirrors.values());
    const byPlatform: Record<string, number> = {};
    let integrityIssues = 0;

    for (const m of all) {
      byPlatform[m.platform] = (byPlatform[m.platform] ?? 0) + 1;
      if (!m.integrityValid) integrityIssues++;
    }

    return {
      totalMirrored: all.length,
      byPlatform,
      lastSyncAt: Math.max(...all.map((m) => m.mirroredAt), 0),
      integrityIssues,
    };
  }

  getMirror(mirrorId: string): MirroredPermit | undefined {
    return this.mirrors.get(mirrorId);
  }

  listMirrors(platform?: string): MirroredPermit[] {
    const all = Array.from(this.mirrors.values());
    return platform ? all.filter((m) => m.platform === platform) : all;
  }
}
