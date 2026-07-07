import { createHash, randomUUID } from 'crypto';
import pool from '../db';

export interface AuditEntry {
  event: string;
  sessionId?: string;
  timestamp: number;
  [key: string]: unknown;
}

interface StoredEntry {
  id: string;
  prevHash: string;
  hash: string;
  entry: AuditEntry;
}

export class AuditChain {
  private chain: StoredEntry[] = [];
  private prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  private flushQueue: StoredEntry[] = [];
  private flushing = false;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.flushInterval = setInterval(() => this.flush(), 5_000);
  }

  append(entry: AuditEntry): StoredEntry {
    const id = randomUUID();
    const payload = JSON.stringify({ id, prevHash: this.prevHash, entry });
    const hash = createHash('sha256').update(payload).digest('hex');

    const stored: StoredEntry = { id, prevHash: this.prevHash, hash, entry };
    this.chain.push(stored);
    this.prevHash = hash;
    this.flushQueue.push(stored);

    return stored;
  }

  verify(): { valid: boolean; brokenAt?: number } {
    let prev = '0000000000000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < this.chain.length; i++) {
      const item = this.chain[i];
      if (item.prevHash !== prev) {
        return { valid: false, brokenAt: i };
      }
      const payload = JSON.stringify({ id: item.id, prevHash: item.prevHash, entry: item.entry });
      const computed = createHash('sha256').update(payload).digest('hex');
      if (computed !== item.hash) {
        return { valid: false, brokenAt: i };
      }
      prev = item.hash;
    }
    return { valid: true };
  }

  getLength(): number {
    return this.chain.length;
  }

  getLatestHash(): string {
    return this.prevHash;
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.flushQueue.length === 0) return;
    this.flushing = true;

    const batch = this.flushQueue.splice(0, 100);
    try {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const item of batch) {
        placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
        values.push(item.id, item.prevHash, item.hash, JSON.stringify(item.entry), new Date(item.entry.timestamp));
        idx += 5;
      }

      await pool.query(
        `INSERT INTO audit_chain (id, prev_hash, hash, entry, created_at) VALUES ${placeholders.join(', ')}`,
        values,
      );
    } catch (err) {
      console.error('[Audit] Flush to DB failed:', err);
      this.flushQueue.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) clearInterval(this.flushInterval);
    await this.flush();
  }
}
