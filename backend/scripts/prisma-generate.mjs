import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

process.env.DATABASE_URL ??=
  'postgresql://localhost:5432/nexus_banking?schema=public';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

const binaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const candidateExecutables = [
  join(process.cwd(), 'node_modules', '.bin', binaryName),
  join(resolve(process.cwd(), '..'), 'node_modules', '.bin', binaryName),
];
const executable = candidateExecutables.find((candidate) =>
  existsSync(candidate),
);

if (!executable) {
  console.error(
    `Prisma CLI binary was not found at: ${candidateExecutables.join(', ')}`,
  );
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
