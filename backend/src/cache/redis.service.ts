import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import type { EnvironmentVariables } from '../config/environment';
import {
  type InfrastructureCheck,
  measureDuration,
} from '../infrastructure/infrastructure.types';

@Injectable()
export class RedisService {
  private client: Redis | null = null;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get('UPSTASH_REDIS_REST_URL', { infer: true }) &&
      this.configService.get('UPSTASH_REDIS_REST_TOKEN', { infer: true }),
    );
  }

  getClient(): Redis {
    if (!this.client) {
      const url = this.configService.get('UPSTASH_REDIS_REST_URL', {
        infer: true,
      });
      const token = this.configService.get('UPSTASH_REDIS_REST_TOKEN', {
        infer: true,
      });

      if (!url || !token) {
        throw new Error('Upstash Redis is not configured');
      }

      this.client = new Redis({ url, token });
    }

    return this.client;
  }

  async setOtp(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.getClient().set(`otp:${key}`, value, { ex: ttlSeconds });
  }

  async getOtp(key: string): Promise<string | null> {
    return this.getClient().get<string>(`otp:${key}`);
  }

  async setSession(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.getClient().set(`session:${key}`, value, { ex: ttlSeconds });
  }

  async getSession(key: string): Promise<string | null> {
    return this.getClient().get<string>(`session:${key}`);
  }

  async deleteSession(key: string): Promise<void> {
    await this.getClient().del(`session:${key}`);
  }

  async setCache(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.getClient().set(`cache:${key}`, value, { ex: ttlSeconds });
  }

  async getCache(key: string): Promise<string | null> {
    return this.getClient().get<string>(`cache:${key}`);
  }

  async deleteCache(key: string): Promise<void> {
    await this.getClient().del(`cache:${key}`);
  }

  async getJsonCache<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getCache(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJsonCache<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.setCache(key, JSON.stringify(value), ttlSeconds);
    } catch {
      // Cache writes are an optimization and must not block banking flows.
    }
  }

  async deleteCacheSilently(key: string): Promise<void> {
    try {
      await this.deleteCache(key);
    } catch {
      // Cache invalidation is best-effort when Redis is unavailable.
    }
  }

  async deleteOtp(key: string): Promise<void> {
    await this.getClient().del(`otp:${key}`);
  }

  async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    const client = this.getClient();
    const rateLimitKey = `rate-limit:${key}`;
    const count = await client.incr(rateLimitKey);

    if (count === 1) {
      await client.expire(rateLimitKey, ttlSeconds);
    }

    return count;
  }

  async healthCheck(): Promise<InfrastructureCheck> {
    if (!this.isConfigured()) {
      return {
        name: 'Upstash Redis',
        status: 'missing',
        detail: 'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing',
      };
    }

    const startedAt = Date.now();

    try {
      const pong = await this.getClient().ping();

      return {
        name: 'Upstash Redis',
        status: typeof pong === 'string' ? 'ready' : 'error',
        detail: `ping response: ${String(pong)}`,
        latencyMs: measureDuration(startedAt),
      };
    } catch (error) {
      return {
        name: 'Upstash Redis',
        status: 'error',
        detail: error instanceof Error ? error.message : 'redis ping failed',
        latencyMs: measureDuration(startedAt),
      };
    }
  }
}
