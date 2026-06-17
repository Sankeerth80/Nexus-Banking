import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined ? undefined : value;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const numberFromEnv = (
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') {
      return defaultValue;
    }

    return Number(value);
  }, z.number().int().min(minimum).max(maximum));

const decimalFromEnv = (
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') {
      return defaultValue;
    }

    return Number(value);
  }, z.number().min(minimum).max(maximum));

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_ENV: z.string().min(1).default('local'),
  PORT: numberFromEnv(4000, 1, 65535).optional(),
  API_PORT: numberFromEnv(4000, 1, 65535),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  DEMO_BANKING_MODE: z.enum(['true']).default('true'),
  BANKING_RAILS_MODE: z.enum(['simulation']).default('simulation'),

  DATABASE_URL: optionalUrl,
  DIRECT_URL: optionalUrl,

  JWT_ACCESS_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  SESSION_SECRET: optionalString,
  BCRYPT_SALT_ROUNDS: numberFromEnv(12, 10, 15),

  OTP_TTL_SECONDS: numberFromEnv(300, 60, 900),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  MINIO_ENDPOINT: optionalString,
  MINIO_PORT: numberFromEnv(9000, 1, 65535),
  MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
  MINIO_ACCESS_KEY: optionalString,
  MINIO_SECRET_KEY: optionalString,
  MINIO_BUCKET_KYC: z.string().min(1).default('kyc'),
  MINIO_BUCKET_STATEMENTS: z.string().min(1).default('statements'),
  MINIO_BUCKET_PHOTOS: z.string().min(1).default('photos'),
  MINIO_BUCKET_SIGNATURES: z.string().min(1).default('signatures'),

  BREVO_API_KEY: optionalString,
  BREVO_SMTP_HOST: z.string().min(1).default('smtp-relay.brevo.com'),
  BREVO_SMTP_PORT: numberFromEnv(587, 1, 65535),
  BREVO_SMTP_USER: optionalString,
  BREVO_SMTP_PASSWORD: optionalString,
  BREVO_FROM_EMAIL: optionalString,
  BREVO_FROM_NAME: z.string().min(1).default('Nexus Banking'),

  SENTRY_DSN: optionalUrl,
  SENTRY_TRACES_SAMPLE_RATE: decimalFromEnv(0.1, 0, 1),

  RATE_LIMIT_TTL_MS: numberFromEnv(60000, 1000, 3600000),
  RATE_LIMIT_MAX: numberFromEnv(100, 1, 10000),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
