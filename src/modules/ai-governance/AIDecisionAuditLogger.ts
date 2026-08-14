/**
 * Module 45 — AI Decision Audit Logger
 * Every AI action logged with correlation ID, inputs, outputs, and escalation status
 */

export interface AIAuditEntry {
  entryId: string;
  correlationId: string;
  sessionId: string;
  aiPlatform: string;
  action: string;
  domain: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  escalationStatus: 'NONE' | 'ESCALATED' | 'HUMAN_APPROVED' | 'HUMAN_REJECTED';
  escalatedTo: string | null;
  decisionConfidence: number;  // 0-1
  tokensUsed: number;
  latencyMs: number;
  contentHash: string;
  timestamp: number;
  cid: string | null;          // IPFS CID for permanent storage
}

export interface AuditQuery {
  correlationId?: string;
  sessionId?: string;
  aiPlatform?: string;
  domain?: string;
  escalationStatus?: AIAuditEntry['escalationStatus'];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEntries: number;
  byPlatform: Record<string, number>;
  byDomain: Record<string, number>;
  escalationRate: number;
  averageConfidence: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
}

export class AIDecisionAuditLogger {
  private entries = new Map<string, AIAuditEntry>();
  private correlationIndex = new Map<string, string[]>();
  private entryCounter = 0;

  async logDecision(
    correlationId: string,
    sessionId: string,
    aiPlatform: string,
    action: string,
    domain: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    escalationStatus: AIAuditEntry['escalationStatus'],
    decisionConfidence: number,
    tokensUsed: number,
    latencyMs: number,
    escalatedTo?: string
  ): Promise<AIAuditEntry> {
    const entryId = `audit-${++this.entryCounter}-${Date.now()}`;

    // Hash the entry for integrity verification
    const contentHash = await this.hashEntry({ correlationId, action, inputs, outputs, timestamp: Date.now() });

    const entry: AIAuditEntry = {
      entryId,
      correlationId,
      sessionId,
      aiPlatform,
      action,
      domain,
      inputs,
      outputs,
      escalationStatus,
      escalatedTo: escalatedTo ?? null,
      decisionConfidence,
      tokensUsed,
      latencyMs,
      contentHash,
      timestamp: Date.now(),
      cid: null, // Set after IPFS pin
    };

    this.entries.set(entryId, entry);

    // Index by correlation ID
    const correlated = this.correlationIndex.get(correlationId) ?? [];
    correlated.push(entryId);
    this.correlationIndex.set(correlationId, correlated);

    return entry;
  }

  async query(q: AuditQuery): Promise<AIAuditEntry[]> {
    let results = Array.from(this.entries.values());

    if (q.correlationId) results = results.filter((e) => e.correlationId === q.correlationId);
    if (q.sessionId) results = results.filter((e) => e.sessionId === q.sessionId);
    if (q.aiPlatform) results = results.filter((e) => e.aiPlatform === q.aiPlatform);
    if (q.domain) results = results.filter((e) => e.domain === q.domain);
    if (q.escalationStatus) results = results.filter((e) => e.escalationStatus === q.escalationStatus);
    if (q.fromTimestamp) results = results.filter((e) => e.timestamp >= q.fromTimestamp!);
    if (q.toTimestamp) results = results.filter((e) => e.timestamp <= q.toTimestamp!);

    results.sort((a, b) => b.timestamp - a.timestamp);

    const offset = q.offset ?? 0;
    const limit = q.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  async getCorrelationChain(correlationId: string): Promise<AIAuditEntry[]> {
    const entryIds = this.correlationIndex.get(correlationId) ?? [];
    return entryIds
      .map((id) => this.entries.get(id))
      .filter(Boolean) as AIAuditEntry[];
  }

  async getStats(fromTimestamp?: number): Promise<AuditStats> {
    let all = Array.from(this.entries.values());
    if (fromTimestamp) all = all.filter((e) => e.timestamp >= fromTimestamp);

    const byPlatform: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    let escalated = 0;

    for (const entry of all) {
      byPlatform[entry.aiPlatform] = (byPlatform[entry.aiPlatform] ?? 0) + 1;
      byDomain[entry.domain] = (byDomain[entry.domain] ?? 0) + 1;
      if (entry.escalationStatus !== 'NONE') escalated++;
    }

    return {
      totalEntries: all.length,
      byPlatform,
      byDomain,
      escalationRate: all.length > 0 ? escalated / all.length : 0,
      averageConfidence: all.length > 0
        ? all.reduce((s, e) => s + e.decisionConfidence, 0) / all.length
        : 0,
      averageLatencyMs: all.length > 0
        ? all.reduce((s, e) => s + e.latencyMs, 0) / all.length
        : 0,
      totalTokensUsed: all.reduce((s, e) => s + e.tokensUsed, 0),
    };
  }

  private async hashEntry(content: unknown): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(content));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
