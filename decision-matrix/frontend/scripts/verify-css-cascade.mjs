/**
 * Verify split CSS files concatenate to the monolith snapshot (lines 3+).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');
const snapshotPath = path.join(srcDir, 'styles', '.snapshot-monolith.css');
const indexPath = path.join(srcDir, 'index.css');

const SEGMENTS = [
  'styles/tokens.css',
  'styles/base.css',
  'styles/layout/app-shell.css',
  'styles/components/buttons.css',
  'styles/components/forms.css',
  'styles/components/cards-tables.css',
  'styles/features/matrix.css',
  'styles/features/map-core.css',
  'styles/features/map-tools.css',
  'styles/components/app-select.css',
  'styles/features/rates.css',
  'styles/features/parameters.css',
  'styles/features/dashboard.css',
  'styles/features/flow-schematic.css',
  'styles/features/task-log.css',
  'styles/components/page-chrome.css',
  'styles/components/app-modal.css',
  'styles/responsive/projects-table.css',
  'styles/responsive/mobile-global.css',
  'styles/features/one-pager.css',
  'styles/features/import-3d.css',
  'styles/features/export.css',
  'styles/features/admin-assistant.css',
];

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function normalize(s) {
  return s.replace(/\r\n/g, '\n').trimEnd();
}

const snapshot = read(snapshotPath);
const snapshotLines = snapshot.split('\n');
let snapEnd = snapshotLines.length;
if (snapEnd > 0 && snapshotLines[snapEnd - 1] === '') snapEnd--;
const expectedBody = snapshotLines.slice(2, snapEnd).join('\n'); // from line 3

const parts = SEGMENTS.map((rel) => {
  const p = path.join(srcDir, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}`);
  return read(p);
});

const combined = parts.join('');
const index = read(indexPath);
const importCount = (index.match(/^@import /gm) || []).length;

if (normalize(combined) !== normalize(expectedBody)) {
  const a = normalize(combined);
  const b = normalize(expectedBody);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.error('Cascade mismatch at char', i);
  console.error('Expected:', JSON.stringify(b.slice(i, i + 80)));
  console.error('Got:     ', JSON.stringify(a.slice(i, i + 80)));
  process.exit(1);
}

if (importCount !== SEGMENTS.length + 1) {
  console.error(`index.css has ${importCount} imports, expected ${SEGMENTS.length + 1} (incl. tailwind)`);
  process.exit(1);
}

console.log(`OK: ${SEGMENTS.length} files match snapshot (${combined.length} chars)`);
