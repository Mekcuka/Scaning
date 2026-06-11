/**
 * One-time runner: split map-core.css and map-tools.css into features/map/.
 * node scripts/run-map-css-split.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splitScript = path.join(__dirname, 'split-css-file.mjs');

const mapCoreParts = [
  { out: 'styles/features/map/page-layout.css', start: 1, end: 55 },
  { out: 'styles/features/map/layers-panel.css', start: 56, end: 373 },
  { out: 'styles/features/map/canvas.css', start: 374, end: 397 },
  { out: 'styles/features/map/group-panel.css', start: 398, end: 690 },
  { out: 'styles/features/map/autoroad-panel.css', start: 691, end: 1195 },
  { out: 'styles/features/map/object-detail-shell.css', start: 1196, end: 1824 },
];

const mapToolsParts = [
  { out: 'styles/features/map/sand-haul-leg-tables.css', start: 1, end: 73 },
  { out: 'styles/features/map/object-detail-fields.css', start: 74, end: 186 },
  { out: 'styles/features/map/poi-create-form.css', start: 187, end: 509 },
  { out: 'styles/features/map/object-detail-footer.css', start: 510, end: 575 },
  { out: 'styles/features/map/toolbar.css', start: 576, end: 673 },
];

function run(rel, parts) {
  const res = spawnSync(
    process.execPath,
    [splitScript, rel, JSON.stringify(parts)],
    { stdio: 'inherit', cwd: path.resolve(__dirname, '..') },
  );
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run('styles/features/map-core.css', mapCoreParts);
run('styles/features/map-tools.css', mapToolsParts);
console.log('Map CSS split complete.');
