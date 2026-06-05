import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'sqlite+aiosqlite:///./data/sppr.db';
const python = process.platform === 'win32' ? 'python' : 'python3';

export default async function globalTeardown(): Promise<void> {
  const result = spawnSync(python, ['scripts/cleanup_e2e_data.py'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, PYTHONPATH: backendDir },
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    console.warn('[e2e teardown] cleanup failed:', result.stderr?.trim() || result.stdout?.trim());
    return;
  }

  const line = result.stdout?.trim();
  if (line) console.log(`[e2e teardown] ${line}`);
}
