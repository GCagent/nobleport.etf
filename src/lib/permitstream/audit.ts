import type { AuditEntry } from './types';

/**
 * Deterministic FNV-1a 64-bit hash. Matches the hash style used by the
 * NoblePort audit chain so PermitStream entries can be folded into the same
 * downstream merkle tree without forcing a Web Crypto dependency.
 */
export function hash(input: string): string {
  let h = BigInt('0xcbf29ce484222325');
  const prime = BigInt('0x100000001b3');
  const mask = BigInt('0xffffffffffffffff');
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

export class AuditChain {
  private entries: AuditEntry[] = [];
  private head = '0'.repeat(16);

  append(
    runId: string,
    submissionId: string,
    action: AuditEntry['action'],
    payload: Record<string, unknown>,
  ): AuditEntry {
    const ts = new Date().toISOString();
    const body = JSON.stringify({ ts, runId, submissionId, action, payload, prev: this.head });
    const h = hash(body);
    const entry: AuditEntry = {
      id: `aud-${this.entries.length + 1}`,
      ts,
      runId,
      submissionId,
      action,
      hash: h,
      prevHash: this.head,
      payload,
    };
    this.head = h;
    this.entries.push(entry);
    return entry;
  }

  verify(): { ok: boolean; brokeAt?: string } {
    let prev = '0'.repeat(16);
    for (const e of this.entries) {
      if (e.prevHash !== prev) return { ok: false, brokeAt: e.id };
      const body = JSON.stringify({
        ts: e.ts,
        runId: e.runId,
        submissionId: e.submissionId,
        action: e.action,
        payload: e.payload,
        prev: e.prevHash,
      });
      if (hash(body) !== e.hash) return { ok: false, brokeAt: e.id };
      prev = e.hash;
    }
    return { ok: true };
  }

  list(): AuditEntry[] {
    return this.entries.slice();
  }
}
