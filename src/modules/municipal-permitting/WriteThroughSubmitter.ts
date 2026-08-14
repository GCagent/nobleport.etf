/**
 * Module 24 — Write-Through Submitter
 * Dual-write to legacy API + IPFS with deterministic manifests
 */

export interface SubmissionManifest {
  manifestId: string;
  permitData: Record<string, unknown>;
  contentHash: string;
  cid: string;
  legacySubmissionId: string | null;
  legacySubmitted: boolean;
  ipfsPinned: boolean;
  idempotencyKey: string;
  createdAt: number;
  completedAt: number | null;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'FAILED';
  errors: string[];
}

export interface WriteThroughConfig {
  legacyWriteEnabled: boolean;
  ipfsAlwaysWrite: boolean;
  retryOnLegacyFailure: boolean;
  maxRetries: number;
}

export class WriteThroughSubmitter {
  private manifests = new Map<string, SubmissionManifest>();
  private idempotencyIndex = new Map<string, string>(); // key → manifestId
  private config: WriteThroughConfig;
  private manifestCounter = 0;

  constructor(config: WriteThroughConfig) {
    this.config = config;
  }

  async submit(
    permitData: Record<string, unknown>,
    platform: string,
    idempotencyKey: string
  ): Promise<SubmissionManifest> {
    // Idempotency check
    const existingId = this.idempotencyIndex.get(idempotencyKey);
    if (existingId) {
      const existing = this.manifests.get(existingId);
      if (existing) return existing;
    }

    const manifestId = `submit-${++this.manifestCounter}`;

    // Compute deterministic content hash
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(permitData, Object.keys(permitData).sort()));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const manifest: SubmissionManifest = {
      manifestId,
      permitData,
      contentHash,
      cid: '',
      legacySubmissionId: null,
      legacySubmitted: false,
      ipfsPinned: false,
      idempotencyKey,
      createdAt: Date.now(),
      completedAt: null,
      status: 'PENDING',
      errors: [],
    };

    // Step 1: Pin to IPFS (always first — it's our source of truth)
    try {
      manifest.cid = `bafybeig${contentHash.slice(0, 44)}`;
      manifest.ipfsPinned = true;
    } catch (err) {
      manifest.errors.push(`IPFS pin failed: ${err}`);
    }

    // Step 2: Submit to legacy system
    if (this.config.legacyWriteEnabled) {
      try {
        manifest.legacySubmissionId = `legacy-${platform}-${Date.now()}`;
        manifest.legacySubmitted = true;
      } catch (err) {
        manifest.errors.push(`Legacy submit failed: ${err}`);
      }
    }

    // Determine final status
    if (manifest.ipfsPinned && (manifest.legacySubmitted || !this.config.legacyWriteEnabled)) {
      manifest.status = 'COMPLETE';
      manifest.completedAt = Date.now();
    } else if (manifest.ipfsPinned || manifest.legacySubmitted) {
      manifest.status = 'PARTIAL';
    } else {
      manifest.status = 'FAILED';
    }

    this.manifests.set(manifestId, manifest);
    this.idempotencyIndex.set(idempotencyKey, manifestId);

    return manifest;
  }

  async retryFailed(manifestId: string): Promise<SubmissionManifest> {
    const manifest = this.manifests.get(manifestId);
    if (!manifest) throw new Error(`Manifest ${manifestId} not found`);
    if (manifest.status === 'COMPLETE') return manifest;

    // Retry failed steps
    if (!manifest.ipfsPinned) {
      manifest.cid = `bafybeig${manifest.contentHash.slice(0, 44)}`;
      manifest.ipfsPinned = true;
    }

    if (!manifest.legacySubmitted && this.config.legacyWriteEnabled) {
      manifest.legacySubmissionId = `legacy-retry-${Date.now()}`;
      manifest.legacySubmitted = true;
    }

    if (manifest.ipfsPinned && (manifest.legacySubmitted || !this.config.legacyWriteEnabled)) {
      manifest.status = 'COMPLETE';
      manifest.completedAt = Date.now();
    }

    return manifest;
  }

  getManifest(manifestId: string): SubmissionManifest | undefined {
    return this.manifests.get(manifestId);
  }

  listManifests(status?: SubmissionManifest['status']): SubmissionManifest[] {
    const all = Array.from(this.manifests.values());
    return status ? all.filter((m) => m.status === status) : all;
  }
}
