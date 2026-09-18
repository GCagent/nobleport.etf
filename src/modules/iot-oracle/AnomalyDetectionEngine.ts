/**
 * Module 13 — Anomaly Detection Engine
 * Statistical + ML outlier detection on sensor streams with kill-switch triggers
 */

export interface SensorReading {
  deviceId: string;
  sensorType: string;
  value: number;
  timestamp: number;
  unit: string;
}

export interface AnomalyAlert {
  id: string;
  deviceId: string;
  sensorType: string;
  reading: SensorReading;
  anomalyScore: number;
  method: 'ZSCORE' | 'IQR' | 'ISOLATION_FOREST' | 'MOVING_AVERAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  killSwitchTriggered: boolean;
  timestamp: number;
  description: string;
}

export interface KillSwitchConfig {
  enabled: boolean;
  criticalThreshold: number; // Anomaly score that triggers kill-switch
  cooldownMs: number;
  notifyEndpoints: string[];
}

export interface DetectionConfig {
  zScoreThreshold: number;
  iqrMultiplier: number;
  movingAverageWindow: number;
  minSamplesForDetection: number;
  killSwitch: KillSwitchConfig;
}

export class AnomalyDetectionEngine {
  private sensorHistory = new Map<string, SensorReading[]>();
  private alerts: AnomalyAlert[] = [];
  private config: DetectionConfig;
  private killSwitchActive = new Set<string>();
  private alertCounter = 0;

  constructor(config: DetectionConfig) {
    this.config = config;
  }

  async processReading(reading: SensorReading): Promise<AnomalyAlert | null> {
    const key = `${reading.deviceId}:${reading.sensorType}`;
    const history = this.sensorHistory.get(key) ?? [];
    history.push(reading);

    // Keep rolling window
    if (history.length > 1000) history.shift();
    this.sensorHistory.set(key, history);

    if (history.length < this.config.minSamplesForDetection) return null;

    const values = history.map((r) => r.value);

    // Run detection methods
    const zScore = this.calculateZScore(reading.value, values);
    const iqrOutlier = this.checkIQR(reading.value, values);
    const maDeviation = this.checkMovingAverage(reading.value, values);

    // Composite anomaly score (0-1)
    let anomalyScore = 0;
    let method: AnomalyAlert['method'] = 'ZSCORE';

    if (Math.abs(zScore) > this.config.zScoreThreshold) {
      anomalyScore = Math.min(Math.abs(zScore) / (this.config.zScoreThreshold * 2), 1);
      method = 'ZSCORE';
    }
    if (iqrOutlier > 0) {
      const iqrScore = Math.min(iqrOutlier, 1);
      if (iqrScore > anomalyScore) {
        anomalyScore = iqrScore;
        method = 'IQR';
      }
    }
    if (maDeviation > 0.5) {
      if (maDeviation > anomalyScore) {
        anomalyScore = maDeviation;
        method = 'MOVING_AVERAGE';
      }
    }

    if (anomalyScore < 0.3) return null;

    const severity = this.scoreSeverity(anomalyScore);
    const killSwitchTriggered =
      this.config.killSwitch.enabled &&
      anomalyScore >= this.config.killSwitch.criticalThreshold &&
      !this.killSwitchActive.has(key);

    if (killSwitchTriggered) {
      this.killSwitchActive.add(key);
      setTimeout(() => this.killSwitchActive.delete(key), this.config.killSwitch.cooldownMs);
    }

    const alert: AnomalyAlert = {
      id: `anomaly-${++this.alertCounter}`,
      deviceId: reading.deviceId,
      sensorType: reading.sensorType,
      reading,
      anomalyScore,
      method,
      severity,
      killSwitchTriggered,
      timestamp: Date.now(),
      description: `${severity} anomaly detected on ${reading.deviceId}/${reading.sensorType}: value=${reading.value} (score=${anomalyScore.toFixed(3)})`,
    };

    this.alerts.push(alert);
    return alert;
  }

  private calculateZScore(value: number, values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (value - mean) / stdDev;
  }

  private checkIQR(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - this.config.iqrMultiplier * iqr;
    const upper = q3 + this.config.iqrMultiplier * iqr;

    if (value < lower) return (lower - value) / iqr;
    if (value > upper) return (value - upper) / iqr;
    return 0;
  }

  private checkMovingAverage(value: number, values: number[]): number {
    const window = values.slice(-this.config.movingAverageWindow);
    const ma = window.reduce((s, v) => s + v, 0) / window.length;
    const deviation = Math.abs(value - ma) / (ma || 1);
    return Math.min(deviation, 1);
  }

  private scoreSeverity(score: number): AnomalyAlert['severity'] {
    if (score >= 0.9) return 'CRITICAL';
    if (score >= 0.7) return 'HIGH';
    if (score >= 0.5) return 'MEDIUM';
    return 'LOW';
  }

  getAlerts(deviceId?: string): AnomalyAlert[] {
    if (deviceId) return this.alerts.filter((a) => a.deviceId === deviceId);
    return [...this.alerts];
  }

  isKillSwitchActive(deviceId: string, sensorType: string): boolean {
    return this.killSwitchActive.has(`${deviceId}:${sensorType}`);
  }
}
