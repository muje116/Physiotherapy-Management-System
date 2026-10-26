import { spawnSync } from 'node:child_process';
import process from 'node:process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const packages = [
  '@physiocore/db',
  '@physiocore/schema',
  '@physiocore/api',
  '@physiocore/worker',
  '@physiocore/web',
];

for (const packageName of packages) {
  const result = spawnSync(pnpm, ['--filter', packageName, 'build'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
