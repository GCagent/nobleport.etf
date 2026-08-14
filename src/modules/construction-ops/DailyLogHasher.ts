/**
 * Module 31 — Daily Log Hasher
 * Field reports hashed and batched into daily Merkle roots
 */

export interface DailyFieldReport {
  reportId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  author: string;
  weather: { condition: string; tempHigh: number; tempLow: number };
  workforce: Array<{ trade: string; headcount: number; hours: number }>;
  workPerformed: string;
  materials: Array<{ item: string; quantity: number; unit: string }>;
  safetyIncidents: string[];
  photos: string[]; // CIDs
  notes: string;
}

export interface HashedReport {
  reportId: string;
  contentHash: string;
  cid: string;
  batchDate: string;
  batchPosition: number;
}

export interface DailyBatch {
  date: string;
  projectId: string;
  reports: HashedReport[];
  merkleRoot: string;
  leafCount: number;
  batchedAt: number;
  anchoredOnChain: boolean;
}

export class DailyLogHasher {
  private pendingReports = new Map<string, Array<{ report: DailyFieldReport; hash: string }>>();
  private batches = new Map<string, DailyBatch>();

  async hashAndQueue(report: DailyFieldReport): Promise<HashedReport> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(report));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const cid = `bafybeig${contentHash.slice(0, 44)}`;
    const key = `${report.projectId}:${report.date}`;
    const pending = this.pendingReports.get(key) ?? [];
    pending.push({ report, hash: contentHash });
    this.pendingReports.set(key, pending);

    return {
      reportId: report.reportId,
      contentHash,
      cid,
      batchDate: report.date,
      batchPosition: pending.length - 1,
    };
  }

  async finalizeDailyBatch(projectId: string, date: string): Promise<DailyBatch> {
    const key = `${projectId}:${date}`;
    const pending = this.pendingReports.get(key);
    if (!pending || pending.length === 0) {
      throw new Error(`No reports pending for ${key}`);
    }

    const leaves = pending.map((p) => p.hash);
    const merkleRoot = await this.computeMerkleRoot(leaves);

    const batch: DailyBatch = {
      date,
      projectId,
      reports: pending.map((p, i) => ({
        reportId: p.report.reportId,
        contentHash: p.hash,
        cid: `bafybeig${p.hash.slice(0, 44)}`,
        batchDate: date,
        batchPosition: i,
      })),
      merkleRoot,
      leafCount: leaves.length,
      batchedAt: Date.now(),
      anchoredOnChain: false,
    };

    this.batches.set(key, batch);
    this.pendingReports.delete(key);

    return batch;
  }

  async getBatch(projectId: string, date: string): Promise<DailyBatch | undefined> {
    return this.batches.get(`${projectId}:${date}`);
  }

  async markAnchored(projectId: string, date: string): Promise<void> {
    const batch = this.batches.get(`${projectId}:${date}`);
    if (batch) batch.anchoredOnChain = true;
  }

  private async computeMerkleRoot(leaves: string[]): Promise<string> {
    if (leaves.length === 0) return '';
    let level = [...leaves];
    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] ?? left;
        const encoder = new TextEncoder();
        const combined = encoder.encode(left + right);
        const hash = await crypto.subtle.digest('SHA-256', combined);
        next.push(Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join(''));
      }
      level = next;
    }
    return level[0];
  }
}
