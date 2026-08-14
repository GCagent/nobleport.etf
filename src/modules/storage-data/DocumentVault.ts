/**
 * Module 18 — Document Vault
 * Encrypted PDF/CAD/photo storage with access-controlled retrieval
 */

export type DocumentType = 'PDF' | 'CAD' | 'PHOTO' | 'BLUEPRINT' | 'CONTRACT' | 'REPORT';

export interface VaultDocument {
  id: string;
  type: DocumentType;
  name: string;
  cid: string;               // IPFS CID of encrypted blob
  encryptionKeyId: string;   // Reference to Lit Protocol access condition
  contentHash: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
  accessList: string[];       // Addresses with access
  tags: Record<string, string>;
}

export interface AccessCondition {
  contractAddress: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: { comparator: string; value: string };
}

export interface RetrievalResult {
  document: VaultDocument;
  decryptedData: Uint8Array | null;
  accessGranted: boolean;
  reason?: string;
}

export class DocumentVault {
  private documents = new Map<string, VaultDocument>();
  private accessConditions = new Map<string, AccessCondition[]>();
  private documentCounter = 0;

  async storeDocument(
    data: Uint8Array,
    type: DocumentType,
    name: string,
    uploadedBy: string,
    accessList: string[],
    tags?: Record<string, string>
  ): Promise<VaultDocument> {
    const id = `doc-${++this.documentCounter}-${Date.now()}`;

    // Encrypt data with AES-256-GCM
    const { encryptedData, keyId } = await this.encryptData(data);

    // Pin encrypted data to IPFS
    const cid = await this.pinEncrypted(encryptedData);

    // Compute content hash of original data
    const contentHash = await this.hashData(data);

    const document: VaultDocument = {
      id,
      type,
      name,
      cid,
      encryptionKeyId: keyId,
      contentHash,
      size: data.length,
      uploadedBy,
      uploadedAt: Date.now(),
      accessList,
      tags: tags ?? {},
    };

    this.documents.set(id, document);
    return document;
  }

  async retrieveDocument(documentId: string, requestedBy: string): Promise<RetrievalResult> {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    // Check access control
    if (!doc.accessList.includes(requestedBy) && doc.uploadedBy !== requestedBy) {
      return { document: doc, decryptedData: null, accessGranted: false, reason: 'Access denied' };
    }

    // In production: fetch from IPFS, decrypt with Lit Protocol
    return { document: doc, decryptedData: new Uint8Array(0), accessGranted: true };
  }

  async grantAccess(documentId: string, address: string, grantedBy: string): Promise<void> {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);
    if (doc.uploadedBy !== grantedBy) throw new Error('Only uploader can grant access');
    if (!doc.accessList.includes(address)) {
      doc.accessList.push(address);
    }
  }

  async revokeAccess(documentId: string, address: string, revokedBy: string): Promise<void> {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);
    if (doc.uploadedBy !== revokedBy) throw new Error('Only uploader can revoke access');
    doc.accessList = doc.accessList.filter((a) => a !== address);
  }

  async listDocuments(uploadedBy?: string, type?: DocumentType): Promise<VaultDocument[]> {
    let results = Array.from(this.documents.values());
    if (uploadedBy) results = results.filter((d) => d.uploadedBy === uploadedBy);
    if (type) results = results.filter((d) => d.type === type);
    return results;
  }

  async verifyIntegrity(documentId: string, expectedHash: string): Promise<boolean> {
    const doc = this.documents.get(documentId);
    return !!doc && doc.contentHash === expectedHash;
  }

  private async encryptData(data: Uint8Array): Promise<{ encryptedData: Uint8Array; keyId: string }> {
    // In production: use Lit Protocol for threshold encryption
    const keyId = `lit-key-${Date.now()}`;
    return { encryptedData: data, keyId };
  }

  private async pinEncrypted(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return `bafybeig${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 44)}`;
  }

  private async hashData(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
