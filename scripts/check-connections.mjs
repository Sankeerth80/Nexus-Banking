import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFileArgIndex = process.argv.indexOf('--env-file');
const envFile =
  envFileArgIndex >= 0 ? process.argv.at(envFileArgIndex + 1) : undefined;
const shouldCheckExternal = process.argv.includes('--external');

const backendRequired = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET_KYC',
  'MINIO_BUCKET_STATEMENTS',
  'MINIO_BUCKET_PHOTOS',
  'MINIO_BUCKET_SIGNATURES',
  'MINIO_BUCKET_REPORTS',
  'BREVO_API_KEY',
  'BREVO_FROM_EMAIL',
  'BREVO_SMTP_USER',
  'BREVO_SMTP_PASSWORD',
  'SENTRY_DSN',
];

const frontendRequired = [
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_SOCKET_URL',
  'NEXT_PUBLIC_DEMO_MODE',
];

function parseEnvFile(path) {
  if (!path) {
    return {};
  }

  const absolutePath = resolve(path);
  const content = readFileSync(absolutePath, 'utf8');
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"+|"+$/g, '');
    values[key] = value;
  }

  return values;
}

function isConfigured(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('<PASTE_') &&
    !value.includes('<YOUR_') &&
    !value.includes('your-') &&
    !value.includes('example.com')
  );
}

function readEnv() {
  return {
    ...parseEnvFile(envFile),
    ...process.env,
  };
}

function checkRequiredGroup(name, keys, env) {
  const missing = keys.filter((key) => !isConfigured(env[key]));

  if (missing.length === 0) {
    return { name, status: 'pass', detail: 'all required values are configured' };
  }

  return {
    name,
    status: 'warn',
    detail: `missing or placeholder values: ${missing.join(', ')}`,
  };
}

function hasAnyConfiguredKey(keys, env) {
  return keys.some((key) => Object.hasOwn(env, key));
}

function checkSimulationMode(env) {
  const demoMode = env.DEMO_BANKING_MODE ?? env.NEXT_PUBLIC_DEMO_MODE;
  const railsMode = env.BANKING_RAILS_MODE;

  if (demoMode === 'true' && (!railsMode || railsMode === 'simulation')) {
    return {
      name: 'Simulation safety',
      status: 'pass',
      detail: 'demo mode is enabled and live banking rails are disabled',
    };
  }

  return {
    name: 'Simulation safety',
    status: 'fail',
    detail: 'DEMO_BANKING_MODE must be true and BANKING_RAILS_MODE must be simulation',
  };
}

function checkUrl(name, value) {
  if (!isConfigured(value)) {
    return { name, status: 'warn', detail: 'not configured' };
  }

  try {
    new URL(value);
    return { name, status: 'pass', detail: 'valid URL shape' };
  } catch {
    return { name, status: 'fail', detail: 'invalid URL shape' };
  }
}

async function checkHttp(name, url, options) {
  try {
    const response = await fetch(url, options);
    return {
      name,
      status: response.ok ? 'pass' : 'warn',
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: 'warn',
      detail: error instanceof Error ? error.message : 'request failed',
    };
  }
}

async function checkNeonDatabase(databaseUrl) {
  if (!isConfigured(databaseUrl)) {
    return { name: 'Neon PostgreSQL', status: 'warn', detail: 'not configured' };
  }

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const result = await pool.query('SELECT 1::int AS result');
    await pool.end();

    return {
      name: 'Neon PostgreSQL',
      status: result.rows[0]?.result === 1 ? 'pass' : 'warn',
      detail: 'SELECT 1 query completed',
    };
  } catch (error) {
    return {
      name: 'Neon PostgreSQL',
      status: 'warn',
      detail: error instanceof Error ? error.message : 'database query failed',
    };
  }
}

async function main() {
  const env = readEnv();
  const checks = [checkSimulationMode(env)];

  if (!envFile || hasAnyConfiguredKey(frontendRequired, env)) {
    checks.push(
      checkRequiredGroup('Frontend env', frontendRequired, env),
      checkUrl('Frontend API URL', env.NEXT_PUBLIC_API_BASE_URL),
      checkUrl('Socket URL', env.NEXT_PUBLIC_SOCKET_URL),
    );
  }

  if (!envFile || hasAnyConfiguredKey(backendRequired, env)) {
    checks.push(
      checkRequiredGroup('Backend env', backendRequired, env),
      checkUrl('Neon database URL', env.DATABASE_URL),
      checkUrl('Upstash REST URL', env.UPSTASH_REDIS_REST_URL),
      checkUrl('Sentry DSN', env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN),
    );
  }

  if (shouldCheckExternal && isConfigured(env.NEXT_PUBLIC_API_BASE_URL)) {
    checks.push(
      await checkHttp(
        'API health endpoint',
        `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/health`,
      ),
    );
  }

  if (
    shouldCheckExternal &&
    isConfigured(env.DATABASE_URL)
  ) {
    checks.push(await checkNeonDatabase(env.DATABASE_URL));
  }

  if (
    shouldCheckExternal &&
    isConfigured(env.UPSTASH_REDIS_REST_URL) &&
    isConfigured(env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    checks.push(
      await checkHttp(
        'Upstash Redis REST',
        `${env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '')}/ping`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        },
      ),
    );
  }

  if (shouldCheckExternal && isConfigured(env.BREVO_API_KEY)) {
    checks.push(
      await checkHttp('Brevo API', 'https://api.brevo.com/v3/account', {
        headers: {
          'api-key': env.BREVO_API_KEY,
        },
      }),
    );
  }

  const icon = {
    pass: 'PASS',
    warn: 'WARN',
    fail: 'FAIL',
  };

  for (const check of checks) {
    console.log(`${icon[check.status]} ${check.name}: ${check.detail}`);
  }

  const failed = checks.some((check) => check.status === 'fail');
  process.exit(failed ? 1 : 0);
}

await main();
