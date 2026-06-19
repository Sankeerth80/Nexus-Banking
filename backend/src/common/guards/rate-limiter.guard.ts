import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RedisService } from '../../cache/redis.service';
import type { EnvironmentVariables } from '../../config/environment';
import type { RouteAwareRequest } from '../types/authenticated-request';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RouteAwareRequest>();

    // Extract IP address
    const ip =
      request.headers['x-forwarded-for'] ||
      request.socket.remoteAddress ||
      'unknown-ip';

    // Formulate a key based on route path and client IP
    const routePath = request.route?.path;
    const path = Array.isArray(routePath)
      ? routePath.map(String).join('|')
      : routePath
        ? String(routePath)
        : request.url;
    const key = `${ip}:${path}`;

    // Get limit and TTL from config or defaults
    const ttlMs =
      this.configService.get('RATE_LIMIT_TTL_MS', { infer: true }) ?? 60000;
    const limit =
      this.configService.get('RATE_LIMIT_MAX', { infer: true }) ?? 100;
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));

    try {
      const count = await this.redisService.incrementRateLimit(key, ttlSeconds);
      if (count > limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests, please try again later.',
            retryAfterSeconds: ttlSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If redis fails, log it but let request pass to avoid locking users out
      console.error('Rate limiting Redis error:', error);
    }

    return true;
  }
}
