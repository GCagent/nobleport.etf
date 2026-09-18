/**
 * Module 22 — Legacy System Adapter
 * Thin connectors for common muni platforms (Accela, Tyler, OpenGov)
 */

export type PlatformType = 'ACCELA' | 'TYLER_MUNIS' | 'OPENGOV' | 'CUSTOM_REST' | 'CUSTOM_SOAP';

export interface LegacyPlatformConfig {
  platform: PlatformType;
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  soapWsdl?: string;
  timeout: number;
  retryAttempts: number;
}

export interface PermitRecord {
  externalId: string;
  platform: PlatformType;
  permitNumber: string;
  type: string;
  status: string;
  applicant: string;
  address: string;
  description: string;
  submittedAt: number;
  updatedAt: number;
  rawData: Record<string, unknown>;
}

export interface SyncResult {
  platform: PlatformType;
  recordsFetched: number;
  recordsNew: number;
  recordsUpdated: number;
  errors: string[];
  syncedAt: number;
}

export class LegacySystemAdapter {
  private connectors = new Map<PlatformType, LegacyPlatformConfig>();
  private syncedRecords = new Map<string, PermitRecord>();

  registerConnector(config: LegacyPlatformConfig): void {
    this.connectors.set(config.platform, config);
  }

  async fetchPermits(platform: PlatformType, since?: number): Promise<PermitRecord[]> {
    const config = this.connectors.get(platform);
    if (!config) throw new Error(`No connector registered for ${platform}`);

    switch (platform) {
      case 'ACCELA': return this.fetchAccela(config, since);
      case 'TYLER_MUNIS': return this.fetchTyler(config, since);
      case 'OPENGOV': return this.fetchOpenGov(config, since);
      default: return this.fetchCustomREST(config, since);
    }
  }

  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const [platform, config] of this.connectors) {
      const result = await this.syncPlatform(platform, config);
      results.push(result);
    }
    return results;
  }

  private async syncPlatform(platform: PlatformType, config: LegacyPlatformConfig): Promise<SyncResult> {
    const records = await this.fetchPermits(platform);
    let newCount = 0;
    let updatedCount = 0;

    for (const record of records) {
      const key = `${platform}:${record.externalId}`;
      const existing = this.syncedRecords.get(key);
      if (!existing) {
        newCount++;
      } else if (existing.updatedAt < record.updatedAt) {
        updatedCount++;
      }
      this.syncedRecords.set(key, record);
    }

    return {
      platform,
      recordsFetched: records.length,
      recordsNew: newCount,
      recordsUpdated: updatedCount,
      errors: [],
      syncedAt: Date.now(),
    };
  }

  private async fetchAccela(config: LegacyPlatformConfig, since?: number): Promise<PermitRecord[]> {
    // Accela Civic Platform REST API v4
    // In production: GET /v4/records?module=Building&updateDate>={since}
    return this.buildPlaceholderRecords('ACCELA', config);
  }

  private async fetchTyler(config: LegacyPlatformConfig, since?: number): Promise<PermitRecord[]> {
    // Tyler Technologies Munis API
    return this.buildPlaceholderRecords('TYLER_MUNIS', config);
  }

  private async fetchOpenGov(config: LegacyPlatformConfig, since?: number): Promise<PermitRecord[]> {
    // OpenGov Permitting API
    return this.buildPlaceholderRecords('OPENGOV', config);
  }

  private async fetchCustomREST(config: LegacyPlatformConfig, since?: number): Promise<PermitRecord[]> {
    return this.buildPlaceholderRecords('CUSTOM_REST', config);
  }

  private buildPlaceholderRecords(platform: PlatformType, config: LegacyPlatformConfig): PermitRecord[] {
    // Placeholder — in production this calls the actual API
    return [];
  }

  getSyncedRecord(platform: PlatformType, externalId: string): PermitRecord | undefined {
    return this.syncedRecords.get(`${platform}:${externalId}`);
  }

  listSyncedRecords(platform?: PlatformType): PermitRecord[] {
    const all = Array.from(this.syncedRecords.values());
    return platform ? all.filter((r) => r.platform === platform) : all;
  }
}
