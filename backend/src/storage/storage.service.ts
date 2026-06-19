import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { EnvironmentVariables } from '../config/environment';
import {
  type InfrastructureCheck,
  measureDuration,
} from '../infrastructure/infrastructure.types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

@Injectable()
export class StorageService {
  private client: Client | null = null;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  getBucketNames(): string[] {
    return [
      this.configService.get('MINIO_BUCKET_KYC', { infer: true }),
      this.configService.get('MINIO_BUCKET_STATEMENTS', { infer: true }),
      this.configService.get('MINIO_BUCKET_PHOTOS', { infer: true }),
      this.configService.get('MINIO_BUCKET_SIGNATURES', { infer: true }),
      this.configService.get('MINIO_BUCKET_REPORTS', { infer: true }),
    ];
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get('MINIO_ENDPOINT', { infer: true }) &&
      this.configService.get('MINIO_ACCESS_KEY', { infer: true }) &&
      this.configService.get('MINIO_SECRET_KEY', { infer: true }),
    );
  }

  getClient(): Client {
    if (!this.client) {
      const endPoint = this.configService.get('MINIO_ENDPOINT', {
        infer: true,
      });
      const accessKey = this.configService.get('MINIO_ACCESS_KEY', {
        infer: true,
      });
      const secretKey = this.configService.get('MINIO_SECRET_KEY', {
        infer: true,
      });

      if (!endPoint || !accessKey || !secretKey) {
        throw new Error('MinIO is not configured');
      }

      this.client = new Client({
        endPoint,
        port: this.configService.get('MINIO_PORT', { infer: true }),
        useSSL:
          this.configService.get('MINIO_USE_SSL', { infer: true }) === 'true',
        accessKey,
        secretKey,
      });
    }

    return this.client;
  }

  async ensureBuckets(): Promise<string[]> {
    const client = this.getClient();
    const ensuredBuckets: string[] = [];

    for (const bucketName of this.getBucketNames()) {
      const exists = await client.bucketExists(bucketName);

      if (!exists) {
        await client.makeBucket(bucketName);
      }

      ensuredBuckets.push(bucketName);
    }

    return ensuredBuckets;
  }

  async uploadFile(
    bucketName: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File size exceeds the 10 MB limit.');
    }

    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('File type is not supported.');
    }

    const client = this.getClient();
    await client.putObject(bucketName, objectName, buffer, buffer.length, {
      'content-type': contentType,
    });
    return `${bucketName}/${objectName}`;
  }

  async getPresignedUrl(
    bucketName: string,
    objectName: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const client = this.getClient();
    return client.presignedGetObject(bucketName, objectName, expirySeconds);
  }

  async healthCheck(): Promise<InfrastructureCheck> {
    if (!this.isConfigured()) {
      return {
        name: 'MinIO',
        status: 'missing',
        detail:
          'MINIO_ENDPOINT, MINIO_ACCESS_KEY, or MINIO_SECRET_KEY is missing',
      };
    }

    const startedAt = Date.now();

    try {
      const buckets = await this.ensureBuckets();

      return {
        name: 'MinIO',
        status: 'ready',
        detail: `buckets ready: ${buckets.join(', ')}`,
        latencyMs: measureDuration(startedAt),
      };
    } catch (error) {
      return {
        name: 'MinIO',
        status: 'error',
        detail: error instanceof Error ? error.message : 'bucket check failed',
        latencyMs: measureDuration(startedAt),
      };
    }
  }
}
