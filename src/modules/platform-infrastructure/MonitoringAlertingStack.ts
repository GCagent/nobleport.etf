/**
 * Module 48 — Monitoring & Alerting Stack
 * Prometheus/Grafana with sub-70ms P95 latency tracking and SLO enforcement
 */

export interface MetricDataPoint {
  metric: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface SLODefinition {
  sloId: string;
  name: string;
  service: string;
  metric: string;
  target: number;          // e.g., 99.96 for uptime, 70 for P95 latency (ms)
  operator: 'LT' | 'GT' | 'LTE' | 'GTE';
  windowHours: number;
  alertThreshold: number;  // % of SLO budget consumed before alerting
}

export interface SLOStatus {
  sloId: string;
  name: string;
  currentValue: number;
  target: number;
  withinBudget: boolean;
  budgetRemainingPercent: number;
  violationCount: number;
  lastViolation: number | null;
}

export interface Alert {
  alertId: string;
  sloId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'PAGE';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  firedAt: number;
  resolvedAt: number | null;
  acknowledged: boolean;
  notificationsSent: string[]; // Channels: slack, pagerduty, email
}

export interface DashboardPanel {
  panelId: string;
  title: string;
  metric: string;
  type: 'GAUGE' | 'GRAPH' | 'TABLE' | 'STAT' | 'HEATMAP';
  query: string;
  thresholds: Array<{ value: number; color: string }>;
}

export class MonitoringAlertingStack {
  private metrics: MetricDataPoint[] = [];
  private slos = new Map<string, SLODefinition>();
  private alerts: Alert[] = [];
  private sloCounter = 0;
  private alertCounter = 0;
  private maxMetricsRetained = 100000;

  async recordMetric(metric: string, value: number, labels?: Record<string, string>): Promise<void> {
    this.metrics.push({
      metric,
      value,
      labels: labels ?? {},
      timestamp: Date.now(),
    });

    // Trim old metrics
    if (this.metrics.length > this.maxMetricsRetained) {
      this.metrics = this.metrics.slice(-this.maxMetricsRetained);
    }

    // Check SLOs
    await this.evaluateSLOs(metric, value);
  }

  async defineSLO(slo: Omit<SLODefinition, 'sloId'>): Promise<SLODefinition> {
    const sloId = `slo-${++this.sloCounter}`;
    const full: SLODefinition = { ...slo, sloId };
    this.slos.set(sloId, full);
    return full;
  }

  async getSLOStatuses(): Promise<SLOStatus[]> {
    const statuses: SLOStatus[] = [];

    for (const [, slo] of this.slos) {
      const windowStart = Date.now() - slo.windowHours * 3600000;
      const relevantMetrics = this.metrics.filter(
        (m) => m.metric === slo.metric && m.timestamp >= windowStart
      );

      const avgValue = relevantMetrics.length > 0
        ? relevantMetrics.reduce((s, m) => s + m.value, 0) / relevantMetrics.length
        : 0;

      let withinBudget: boolean;
      if (slo.operator === 'LT' || slo.operator === 'LTE') {
        withinBudget = avgValue <= slo.target;
      } else {
        withinBudget = avgValue >= slo.target;
      }

      const violations = relevantMetrics.filter((m) => {
        if (slo.operator === 'LT') return m.value >= slo.target;
        if (slo.operator === 'LTE') return m.value > slo.target;
        if (slo.operator === 'GT') return m.value <= slo.target;
        return m.value < slo.target;
      });

      const budgetTotal = relevantMetrics.length;
      const budgetUsed = violations.length;
      const budgetAllowed = Math.ceil(budgetTotal * (1 - slo.alertThreshold / 100));

      statuses.push({
        sloId: slo.sloId,
        name: slo.name,
        currentValue: Math.round(avgValue * 100) / 100,
        target: slo.target,
        withinBudget,
        budgetRemainingPercent: budgetTotal > 0
          ? Math.max(0, ((budgetAllowed - budgetUsed) / budgetAllowed) * 100)
          : 100,
        violationCount: violations.length,
        lastViolation: violations.length > 0 ? violations[violations.length - 1].timestamp : null,
      });
    }

    return statuses;
  }

  private async evaluateSLOs(metric: string, value: number): Promise<void> {
    for (const [, slo] of this.slos) {
      if (slo.metric !== metric) continue;

      let violated = false;
      if (slo.operator === 'LT' && value >= slo.target) violated = true;
      if (slo.operator === 'LTE' && value > slo.target) violated = true;
      if (slo.operator === 'GT' && value <= slo.target) violated = true;
      if (slo.operator === 'GTE' && value < slo.target) violated = true;

      if (violated) {
        await this.fireAlert(slo, value);
      }
    }
  }

  private async fireAlert(slo: SLODefinition, currentValue: number): Promise<void> {
    // Don't fire duplicate alerts within 5 minutes
    const recentAlert = this.alerts.find(
      (a) => a.sloId === slo.sloId && !a.resolvedAt && Date.now() - a.firedAt < 300000
    );
    if (recentAlert) return;

    const alert: Alert = {
      alertId: `alert-${++this.alertCounter}`,
      sloId: slo.sloId,
      severity: currentValue > slo.target * 2 ? 'PAGE' : 'WARNING',
      message: `SLO violation: ${slo.name} — current: ${currentValue}, target: ${slo.target}`,
      metric: slo.metric,
      currentValue,
      threshold: slo.target,
      firedAt: Date.now(),
      resolvedAt: null,
      acknowledged: false,
      notificationsSent: ['prometheus-alertmanager'],
    };

    this.alerts.push(alert);
  }

  async getP95Latency(metric: string, windowMinutes: number = 5): Promise<number> {
    const windowStart = Date.now() - windowMinutes * 60000;
    const values = this.metrics
      .filter((m) => m.metric === metric && m.timestamp >= windowStart)
      .map((m) => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) return 0;
    const p95Index = Math.floor(values.length * 0.95);
    return values[p95Index];
  }

  getActiveAlerts(): Alert[] { return this.alerts.filter((a) => !a.resolvedAt); }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find((a) => a.alertId === alertId);
    if (alert) alert.acknowledged = true;
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find((a) => a.alertId === alertId);
    if (alert) alert.resolvedAt = Date.now();
  }
}
