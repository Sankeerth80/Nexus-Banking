import { Injectable } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../observability/metrics.service';
import { StorageService } from '../storage/storage.service';
import type { InfrastructureCheck } from './infrastructure.types';

@Injectable()
export class InfrastructureHealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly metricsService: MetricsService,
  ) {}

  async runChecks(): Promise<InfrastructureCheck[]> {
    const checks = await Promise.all([
      this.prismaService.healthCheck(),
      this.redisService.healthCheck(),
      this.storageService.healthCheck(),
      this.emailService.healthCheck(),
    ]);

    this.metricsService.recordInfrastructureChecks(checks);
    return checks;
  }
}
