/**
 * Module 14 — Sensor Fleet Manager
 * Provisioning, firmware OTA, health monitoring across 3,000+ nodes
 */

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UPDATING' | 'DECOMMISSIONED';

export interface SensorNode {
  deviceId: string;
  siteId: string;
  model: string;
  firmwareVersion: string;
  status: DeviceStatus;
  lastHeartbeat: number;
  batteryLevel: number;       // 0-100
  signalStrength: number;     // dBm
  uptimeHours: number;
  location: { lat: number; lng: number };
  capabilities: string[];
  enrolledAt: number;
}

export interface FirmwareUpdate {
  version: string;
  releaseDate: number;
  targetModels: string[];
  checksum: string;
  size: number;
  changelogUrl: string;
  mandatory: boolean;
}

export interface FleetHealthReport {
  totalNodes: number;
  online: number;
  offline: number;
  degraded: number;
  updating: number;
  averageBatteryLevel: number;
  averageUptimeHours: number;
  criticalNodes: SensorNode[];
  staleNodes: SensorNode[];     // No heartbeat in 15+ min
  timestamp: number;
}

export interface OTAResult {
  deviceId: string;
  success: boolean;
  previousVersion: string;
  newVersion: string;
  duration: number;
  error?: string;
}

export class SensorFleetManager {
  private nodes = new Map<string, SensorNode>();
  private firmwareUpdates: FirmwareUpdate[] = [];
  private heartbeatTimeoutMs = 900000; // 15 minutes

  async provisionNode(node: SensorNode): Promise<void> {
    if (this.nodes.has(node.deviceId)) {
      throw new Error(`Device ${node.deviceId} already provisioned`);
    }
    this.nodes.set(node.deviceId, { ...node, enrolledAt: Date.now() });
  }

  async decommissionNode(deviceId: string): Promise<void> {
    const node = this.nodes.get(deviceId);
    if (!node) throw new Error(`Device ${deviceId} not found`);
    node.status = 'DECOMMISSIONED';
  }

  async recordHeartbeat(deviceId: string, metrics: Partial<SensorNode>): Promise<void> {
    const node = this.nodes.get(deviceId);
    if (!node) throw new Error(`Device ${deviceId} not found`);

    node.lastHeartbeat = Date.now();
    if (metrics.batteryLevel !== undefined) node.batteryLevel = metrics.batteryLevel;
    if (metrics.signalStrength !== undefined) node.signalStrength = metrics.signalStrength;
    if (metrics.status) node.status = metrics.status;
    if (metrics.uptimeHours !== undefined) node.uptimeHours = metrics.uptimeHours;
  }

  async deployFirmwareOTA(
    update: FirmwareUpdate,
    targetDeviceIds?: string[]
  ): Promise<OTAResult[]> {
    this.firmwareUpdates.push(update);
    const targets = targetDeviceIds
      ? targetDeviceIds.map((id) => this.nodes.get(id)).filter(Boolean)
      : Array.from(this.nodes.values()).filter(
          (n) => update.targetModels.includes(n.model) && n.status === 'ONLINE'
        );

    const results: OTAResult[] = [];

    for (const node of targets as SensorNode[]) {
      const previousVersion = node.firmwareVersion;
      node.status = 'UPDATING';

      // Simulate OTA update
      const success = node.batteryLevel > 20 && node.signalStrength > -85;

      if (success) {
        node.firmwareVersion = update.version;
        node.status = 'ONLINE';
      } else {
        node.status = 'DEGRADED';
      }

      results.push({
        deviceId: node.deviceId,
        success,
        previousVersion,
        newVersion: success ? update.version : previousVersion,
        duration: Math.random() * 60000 + 30000,
        error: success ? undefined : 'Insufficient battery or signal',
      });
    }

    return results;
  }

  async getFleetHealth(): Promise<FleetHealthReport> {
    const allNodes = Array.from(this.nodes.values());
    const active = allNodes.filter((n) => n.status !== 'DECOMMISSIONED');
    const now = Date.now();

    const staleNodes = active.filter(
      (n) => n.status === 'ONLINE' && now - n.lastHeartbeat > this.heartbeatTimeoutMs
    );

    const criticalNodes = active.filter(
      (n) => n.batteryLevel < 10 || n.status === 'DEGRADED'
    );

    return {
      totalNodes: active.length,
      online: active.filter((n) => n.status === 'ONLINE').length,
      offline: active.filter((n) => n.status === 'OFFLINE').length,
      degraded: active.filter((n) => n.status === 'DEGRADED').length,
      updating: active.filter((n) => n.status === 'UPDATING').length,
      averageBatteryLevel:
        active.reduce((s, n) => s + n.batteryLevel, 0) / (active.length || 1),
      averageUptimeHours:
        active.reduce((s, n) => s + n.uptimeHours, 0) / (active.length || 1),
      criticalNodes,
      staleNodes,
      timestamp: now,
    };
  }

  getNode(deviceId: string): SensorNode | undefined {
    return this.nodes.get(deviceId);
  }

  listNodes(siteId?: string): SensorNode[] {
    const all = Array.from(this.nodes.values());
    return siteId ? all.filter((n) => n.siteId === siteId) : all;
  }
}
