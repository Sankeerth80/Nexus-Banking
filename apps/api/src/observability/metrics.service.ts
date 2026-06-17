import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  readonly contentType = this.registry.contentType;

  constructor() {
    collectDefaultMetrics({
      prefix: 'nexus_banking_',
      register: this.registry,
    });
  }

  renderMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
