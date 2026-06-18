import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

process.env.DATABASE_URL ??=
  'postgresql://localhost:5432/nexus_banking?schema=public';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

const executable = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

if (!existsSync(executable)) {
  console.error(`Prisma CLI binary was not found at ${executable}`);
  process.exit(1);
}

const result = spawnSync(
  executable,
  ['generate', '--schema=../database/prisma/schema.prisma'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
