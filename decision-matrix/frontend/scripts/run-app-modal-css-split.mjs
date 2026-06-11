/**
 * Split app-modal.css into components/app-modal/*.
 * node scripts/run-app-modal-css-split.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splitScript = path.join(__dirname, 'split-css-file.mjs');

const parts = [
  { out: 'styles/components/app-modal/core.css', start: 1, end: 87 },
  { out: 'styles/components/app-modal/flow-overlays.css', start: 88, end: 442 },
  { out: 'styles/components/app-modal/sand-logistics.css', start: 443, end: 772 },
  { out: 'styles/components/app-modal/overlays.css', start: 773, end: 873 },
];

const res = spawnSync(
  process.execPath,
  [splitScript, 'styles/components/app-modal.css', JSON.stringify(parts)],
  { stdio: 'inherit', cwd: path.resolve(__dirname, '..') },
);
if (res.status !== 0) process.exit(res.status ?? 1);
console.log('app-modal CSS split complete.');
