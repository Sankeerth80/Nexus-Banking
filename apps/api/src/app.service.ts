import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './config/environment';

type IntegrationState = 'configured' | 'missing';

type IntegrationKey =
  | 'DATABASE_URL'
  | 'UPSTASH_REDIS_REST_URL'
  | 'MINIO_ENDPOINT'
  | 'BREVO_API_KEY'
  | 'SENTRY_DSN';

export type IntegrationReport = {
  name: string;
  purpose: string;
  state: IntegrationState;
};

export type PlatformOverview = {
  name: string;
  mode: 'demo';
  bankingRailsMode: 'simulation';
  liveBankingNetworksConnected: false;
  portals: string[];
  transferTypes: string[];
  cardControls: string[];
  securityControls: string[];
  integrations: IntegrationReport[];
};

export type PlatformHealth = {
  status: 'ok';
  service: string;
  timestamp: string;
  environment: string;
  demoBankingMode: true;
  bankingRailsMode: 'simulation';
};

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  getPlatformOverview(): PlatformOverview {
    return {
      name: 'Nexus Banking',
      mode: 'demo',
      bankingRailsMode: 'simulation',
      liveBankingNetworksConnected: false,
      portals: ['User Net Banking Portal', 'Master Admin Portal'],
      transferTypes: [
        'Own Account',
        'Internal Transfer',
        'NEFT Simulation',
        'RTGS Simulation',
        'IMPS Simulation',
        'UPI Simulation',
        'Scheduled Transfer',
      ],
      cardControls: [
        'Block',
        'Unblock',
        'Freeze',
        'Unfreeze',
        'Replace',
        'Set PIN',
        'Change PIN',
        'Manage Limits',
        'Enable ATM',
        'Enable Online Usage',
        'Enable Contactless',
        'Enable International Usage',
      ],
      securityControls: [
        '2FA',
        'OTP',
        'Trusted Devices',
        'Rate Limiting',
        'Session Timeout',
        'CSRF',
        'XSS Protection',
        'SQL Injection Protection',
        'Password Policies',
        'Audit Logging',
      ],
      integrations: [
        this.integration(
          'Neon PostgreSQL',
          'Core relational data',
          'DATABASE_URL',
        ),
        this.integration(
          'Upstash Redis',
          'OTP, sessions, rate limits',
          'UPSTASH_REDIS_REST_URL',
        ),
        this.integration(
          'MinIO',
          'KYC, statements, photos, signatures',
          'MINIO_ENDPOINT',
        ),
        this.integration(
          'Brevo',
          'OTP, reset, alert, notification email',
          'BREVO_API_KEY',
        ),
        this.integration(
          'Sentry',
          'Errors and performance traces',
          'SENTRY_DSN',
        ),
      ],
    };
  }

  getHealth(): PlatformHealth {
    return {
      status: 'ok',
      service: 'nexus-banking-api',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('APP_ENV', { infer: true }),
      demoBankingMode: true,
      bankingRailsMode: 'simulation',
    };
  }

  private integration(
    name: string,
    purpose: string,
    key: IntegrationKey,
  ): IntegrationReport {
    const value = this.configService.get(key, { infer: true });

    return {
      name,
      purpose,
      state:
        typeof value === 'string' && value.trim().length > 0
          ? 'configured'
          : 'missing',
    };
  }
}
