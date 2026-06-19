import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import type { InfrastructureCheck } from '../infrastructure/infrastructure.types';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly infrastructureStatus = new Gauge({
    name: 'nexus_banking_infrastructure_status',
    help: 'Infrastructure provider status where ready is 1 and all other states are 0.',
    labelNames: ['provider', 'status'],
    registers: [this.registry],
  });
  private readonly infrastructureLatency = new Gauge({
    name: 'nexus_banking_infrastructure_latency_ms',
    help: 'Infrastructure health check latency in milliseconds.',
    labelNames: ['provider'],
    registers: [this.registry],
  });
  private readonly apiRequestDuration = new Histogram({
    name: 'nexus_banking_api_request_duration_ms',
    help: 'API request duration in milliseconds.',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });
  private readonly apiErrors = new Counter({
    name: 'nexus_banking_api_errors_total',
    help: 'Total API responses with 5xx status codes.',
    labelNames: ['method', 'path', 'status_code'],
    registers: [this.registry],
  });
  private readonly transactionVolume = new Gauge({
    name: 'nexus_banking_transaction_volume_total',
    help: 'Simulated transaction volume recorded by the platform.',
    registers: [this.registry],
  });
  private readonly pendingApprovals = new Gauge({
    name: 'nexus_banking_pending_approvals',
    help: 'Pending customer approval workflow items.',
    registers: [this.registry],
  });
  private readonly pendingKyc = new Gauge({
    name: 'nexus_banking_pending_kyc',
    help: 'Pending KYC workflow items awaiting review.',
    registers: [this.registry],
  });
  private readonly fraudAlerts = new Gauge({
    name: 'nexus_banking_fraud_alerts_total',
    help: 'Fraud alerts recorded by the simulation risk layer.',
    registers: [this.registry],
  });

  readonly contentType = this.registry.contentType;

  constructor() {
    collectDefaultMetrics({
      prefix: 'nexus_banking_',
      register: this.registry,
    });
    this.transactionVolume.set(0);
    this.pendingApprovals.set(0);
    this.pendingKyc.set(0);
    this.fraudAlerts.set(0);
  }

  renderMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordInfrastructureChecks(checks: InfrastructureCheck[]): void {
    const statuses = ['ready', 'missing', 'error'] as const;

    for (const check of checks) {
      for (const status of statuses) {
        this.infrastructureStatus.set(
          { provider: check.name, status },
          check.status === status ? 1 : 0,
        );
      }

      if (typeof check.latencyMs === 'number') {
        this.infrastructureLatency.set(
          { provider: check.name },
          check.latencyMs,
        );
      }
    }
  }

  observeHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = {
      method,
      path,
      status_code: String(statusCode),
    };

    this.apiRequestDuration.observe(labels, durationMs);

    if (statusCode >= 500) {
      this.apiErrors.inc(labels);
    }
  }
}
