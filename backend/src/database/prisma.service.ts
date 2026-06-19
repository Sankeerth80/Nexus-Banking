import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import type { EnvironmentVariables } from '../config/environment';
import {
  type InfrastructureCheck,
  measureDuration,
} from '../infrastructure/infrastructure.types';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool?: Pool;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const databaseUrl = configService.get('DATABASE_URL', { infer: true });
    const pool =
      databaseUrl && databaseUrl.length > 0
        ? new Pool({
            allowExitOnIdle: true,
            connectionString: databaseUrl,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            max: 5,
          })
        : undefined;
    const adapter = pool ? new PrismaPg(pool) : undefined;

    super(adapter ? { adapter } : {});
    this.pool = pool;
  }

  async onModuleInit() {
    if (this.pool) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.$disconnect();
      await this.pool.end();
    }
  }

  async healthCheck(): Promise<InfrastructureCheck> {
    if (!this.pool) {
      return {
        name: 'Neon PostgreSQL',
        status: 'missing',
        detail: 'DATABASE_URL is not configured',
      };
    }

    const startedAt = Date.now();

    try {
      const result = await this.$queryRaw<Array<{ result: number }>>`
        SELECT 1::int AS result
      `;

      return {
        name: 'Neon PostgreSQL',
        status: result[0]?.result === 1 ? 'ready' : 'error',
        detail: 'database query succeeded',
        latencyMs: measureDuration(startedAt),
      };
    } catch (error) {
      return {
        name: 'Neon PostgreSQL',
        status: 'error',
        detail:
          error instanceof Error ? error.message : 'database query failed',
        latencyMs: measureDuration(startedAt),
      };
    }
  }
}
