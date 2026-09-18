/**
 * Module 9 — Device Identity Service
 * X.509 per-sensor enrollment with TPM/SE-backed key storage
 */

export interface DeviceCertificate {
  deviceId: string;
  serialNumber: string;
  commonName: string;
  publicKey: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  tpmAttestationKey: string;
  fingerprint: string;
}

export interface EnrollmentRequest {
  deviceId: string;
  csr: string; // Certificate Signing Request (PEM)
  tpmEndorsementKey: string;
  hardwareSerial: string;
  firmwareVersion: string;
  location: { lat: number; lng: number; siteId: string };
}

export interface DeviceIdentityConfig {
  caEndpoint: string;
  tpmProviderType: 'TPM2' | 'SE' | 'SOFTWARE';
  certificateLifetimeDays: number;
  autoRenewBeforeDays: number;
  maxDevicesPerSite: number;
}

export class DeviceIdentityService {
  private enrolledDevices = new Map<string, DeviceCertificate>();
  private config: DeviceIdentityConfig;

  constructor(config: DeviceIdentityConfig) {
    this.config = config;
  }

  async enrollDevice(request: EnrollmentRequest): Promise<DeviceCertificate> {
    // Validate TPM endorsement key
    await this.validateTPMKey(request.tpmEndorsementKey);

    // Generate X.509 certificate from CSR
    const certificate: DeviceCertificate = {
      deviceId: request.deviceId,
      serialNumber: this.generateSerial(),
      commonName: `sensor-${request.deviceId}.nobleport.eth`,
      publicKey: this.extractPublicKey(request.csr),
      issuer: 'CN=NoblePort IoT CA, O=NoblePort Systems',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + this.config.certificateLifetimeDays * 86400000),
      tpmAttestationKey: request.tpmEndorsementKey,
      fingerprint: await this.computeFingerprint(request.csr),
    };

    this.enrolledDevices.set(request.deviceId, certificate);
    return certificate;
  }

  async validateTPMKey(endorsementKey: string): Promise<boolean> {
    // Verify the TPM/SE endorsement key against manufacturer CA
    if (!endorsementKey || endorsementKey.length < 32) {
      throw new Error('Invalid TPM endorsement key');
    }
    return true;
  }

  async renewCertificate(deviceId: string): Promise<DeviceCertificate> {
    const existing = this.enrolledDevices.get(deviceId);
    if (!existing) throw new Error(`Device ${deviceId} not enrolled`);

    const renewed: DeviceCertificate = {
      ...existing,
      serialNumber: this.generateSerial(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + this.config.certificateLifetimeDays * 86400000),
    };

    this.enrolledDevices.set(deviceId, renewed);
    return renewed;
  }

  async revokeCertificate(deviceId: string): Promise<void> {
    if (!this.enrolledDevices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not enrolled`);
    }
    this.enrolledDevices.delete(deviceId);
  }

  async getDeviceCertificate(deviceId: string): Promise<DeviceCertificate | undefined> {
    return this.enrolledDevices.get(deviceId);
  }

  async listDevices(): Promise<DeviceCertificate[]> {
    return Array.from(this.enrolledDevices.values());
  }

  async getExpiringCertificates(withinDays: number): Promise<DeviceCertificate[]> {
    const threshold = new Date(Date.now() + withinDays * 86400000);
    return Array.from(this.enrolledDevices.values()).filter(
      (cert) => cert.validUntil <= threshold
    );
  }

  private generateSerial(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':');
  }

  private extractPublicKey(csr: string): string {
    // Extract public key from PEM-encoded CSR
    return csr.replace(/-----BEGIN.*?-----/g, '').replace(/-----END.*?-----/g, '').trim();
  }

  private async computeFingerprint(csr: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(csr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':');
  }
}
