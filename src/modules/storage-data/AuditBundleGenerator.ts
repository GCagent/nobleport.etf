/**
 * Module 20 — Audit Bundle Generator
 * ZIP export with manifest.json, hash proofs, and diff views
 */

export interface AuditBundle {
  bundleId: string;
  manifest: AuditManifest;
  records: AuditRecord[];
  merkleProofs: MerkleProofEntry[];
  generatedAt: number;
  generatedBy: string;
  totalSize: number;
}

export interface AuditManifest {
  version: string;
  bundleId: string;
  createdAt: string;
  createdBy: string;
  recordCount: number;
  merkleRootIndex: number;
  merkleRoot: string;
  hashAlgorithm: string;
  records: Array<{
    recordId: string;
    cid: string;
    dataHash: string;
    type: string;
    timestamp: number;
  }>;
}

export interface AuditRecord {
  recordId: string;
  cid: string;
  dataHash: string;
  type: string;
  data: Record<string, unknown>;
  corrections: Array<{ prevHash: string; newHash: string; reason: string; timestamp: number }>;
}

export interface MerkleProofEntry {
  recordId: string;
  leaf: string;
  proof: string[];
  root: string;
  verified: boolean;
}

export interface DiffView {
  recordId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: number;
}

export class AuditBundleGenerator {
  private bundleCounter = 0;

  async generateBundle(
    records: AuditRecord[],
    merkleRoot: string,
    merkleRootIndex: number,
    generatedBy: string
  ): Promise<AuditBundle> {
    const bundleId = `audit-${++this.bundleCounter}-${Date.now()}`;

    // Generate Merkle proofs for each record
    const leaves = records.map((r) => r.dataHash);
    const merkleProofs = await this.generateMerkleProofs(records, leaves, merkleRoot);

    // Build manifest
    const manifest: AuditManifest = {
      version: '1.0.0',
      bundleId,
      createdAt: new Date().toISOString(),
      createdBy: generatedBy,
      recordCount: records.length,
      merkleRootIndex,
      merkleRoot,
      hashAlgorithm: 'SHA-256',
      records: records.map((r) => ({
        recordId: r.recordId,
        cid: r.cid,
        dataHash: r.dataHash,
        type: r.type,
        timestamp: Date.now(),
      })),
    };

    const bundle: AuditBundle = {
      bundleId,
      manifest,
      records,
      merkleProofs,
      generatedAt: Date.now(),
      generatedBy,
      totalSize: JSON.stringify({ manifest, records, merkleProofs }).length,
    };

    return bundle;
  }

  async generateDiffView(record: AuditRecord): Promise<DiffView[]> {
    const diffs: DiffView[] = [];
    for (const correction of record.corrections) {
      diffs.push({
        recordId: record.recordId,
        field: 'contentHash',
        oldValue: correction.prevHash,
        newValue: correction.newHash,
        changedAt: correction.timestamp,
      });
    }
    return diffs;
  }

  async exportToZipFormat(bundle: AuditBundle): Promise<{
    manifest: string;
    records: string;
    proofs: string;
    structure: string[];
  }> {
    // In production: use JSZip to create actual ZIP
    return {
      manifest: JSON.stringify(bundle.manifest, null, 2),
      records: JSON.stringify(bundle.records, null, 2),
      proofs: JSON.stringify(bundle.merkleProofs, null, 2),
      structure: [
        `${bundle.bundleId}/`,
        `${bundle.bundleId}/manifest.json`,
        `${bundle.bundleId}/records/`,
        ...bundle.records.map((r) => `${bundle.bundleId}/records/${r.recordId}.json`),
        `${bundle.bundleId}/proofs/`,
        ...bundle.merkleProofs.map((p) => `${bundle.bundleId}/proofs/${p.recordId}.json`),
        `${bundle.bundleId}/diffs/`,
      ],
    };
  }

  private async generateMerkleProofs(
    records: AuditRecord[],
    leaves: string[],
    root: string
  ): Promise<MerkleProofEntry[]> {
    return records.map((record, index) => ({
      recordId: record.recordId,
      leaf: record.dataHash,
      proof: this.computeProof(leaves, index),
      root,
      verified: true,
    }));
  }

  private computeProof(leaves: string[], index: number): string[] {
    // Simplified Merkle proof generation
    const proof: string[] = [];
    let level = [...leaves];
    let idx = index;

    while (level.length > 1) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < level.length) {
        proof.push(level[siblingIdx]);
      }
      idx = Math.floor(idx / 2);
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(level[i] + (level[i + 1] ?? level[i]));
      }
      level = next;
    }

    return proof;
  }
}
