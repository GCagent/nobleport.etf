/**
 * Module 17 — CID Registry
 * Per-record hash index mapping off-chain blobs to on-chain Merkle leaves
 */

export interface CIDRecord {
  cid: string;
  dataHash: string;
  merkleLeaf: string;
  merkleRootIndex: number;
  recordType: string;
  createdAt: number;
  createdBy: string;
  metadata: Record<string, unknown>;
}

export interface CIDQuery {
  cid?: string;
  dataHash?: string;
  recordType?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export class CIDRegistry {
  private records = new Map<string, CIDRecord>();
  private hashIndex = new Map<string, string>(); // dataHash → cid
  private typeIndex = new Map<string, string[]>(); // recordType → cid[]

  async register(record: CIDRecord): Promise<void> {
    if (this.records.has(record.cid)) {
      throw new Error(`CID ${record.cid} already registered`);
    }

    this.records.set(record.cid, record);
    this.hashIndex.set(record.dataHash, record.cid);

    const typeList = this.typeIndex.get(record.recordType) ?? [];
    typeList.push(record.cid);
    this.typeIndex.set(record.recordType, typeList);
  }

  async lookup(cid: string): Promise<CIDRecord | undefined> {
    return this.records.get(cid);
  }

  async lookupByHash(dataHash: string): Promise<CIDRecord | undefined> {
    const cid = this.hashIndex.get(dataHash);
    return cid ? this.records.get(cid) : undefined;
  }

  async query(q: CIDQuery): Promise<CIDRecord[]> {
    let results = Array.from(this.records.values());

    if (q.cid) results = results.filter((r) => r.cid === q.cid);
    if (q.dataHash) results = results.filter((r) => r.dataHash === q.dataHash);
    if (q.recordType) results = results.filter((r) => r.recordType === q.recordType);
    if (q.fromTimestamp) results = results.filter((r) => r.createdAt >= q.fromTimestamp!);
    if (q.toTimestamp) results = results.filter((r) => r.createdAt <= q.toTimestamp!);

    results.sort((a, b) => b.createdAt - a.createdAt);

    const offset = q.offset ?? 0;
    const limit = q.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  async verifyIntegrity(cid: string, expectedHash: string): Promise<boolean> {
    const record = this.records.get(cid);
    return !!record && record.dataHash === expectedHash;
  }

  async getStats(): Promise<{ totalRecords: number; recordTypes: Record<string, number> }> {
    const recordTypes: Record<string, number> = {};
    for (const [type, cids] of this.typeIndex) {
      recordTypes[type] = cids.length;
    }
    return { totalRecords: this.records.size, recordTypes };
  }
}
