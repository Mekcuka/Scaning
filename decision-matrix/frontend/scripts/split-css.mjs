/**
 * Split monolithic index.css into styles/ per cascade-order manifest.
 * Run from decision-matrix/frontend: node scripts/split-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const monolithPath = path.join(srcDir, 'index.css');
const snapshotPath = path.join(srcDir, 'styles', '.snapshot-monolith.css');
const stylesDir = path.join(srcDir, 'styles');

/** Inclusive 1-based line ranges; must partition lines 3..end with no gaps/overlaps. */
const SEGMENTS = [
  ['styles/tokens.css', 3, 40],
  ['styles/base.css', 41, 69],
  ['styles/layout/app-shell.css', 70, 96],
  ['styles/components/buttons.css', 97, 134],
  ['styles/components/forms.css', 135, 239],
  ['styles/components/cards-tables.css', 240, 350],
  ['styles/features/matrix.css', 351, 810],
  ['styles/features/map-core.css', 811, 2634],
  ['styles/features/map-tools.css', 2635, 3307],
  ['styles/components/app-select.css', 3308, 3730],
  ['styles/features/rates.css', 3731, 3914],
  ['styles/features/parameters.css', 3915, 4225],
  ['styles/features/dashboard.css', 4226, 4618],
  ['styles/features/flow-schematic.css', 4619, 5170],
  ['styles/features/task-log.css', 5171, 5340],
  ['styles/components/page-chrome.css', 5341, 5383],
  ['styles/components/app-modal.css', 5384, 6256],
  ['styles/responsive/projects-table.css', 6257, 6272],
  ['styles/responsive/mobile-global.css', 6273, 6769],
  ['styles/features/one-pager.css', 6770, 7139],
  ['styles/features/import-3d.css', 7140, 7991],
  ['styles/features/export.css', 7992, 8454],
  ['styles/features/admin-assistant.css', 8455, 9173],
];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
}

function sliceLines(lines, start, end) {
  const chunk = lines.slice(start - 1, end);
  let result = chunk.join('\n');
  // split('\n') drops a trailing blank line unless we add it back
  if (chunk.length > 0 && chunk[chunk.length - 1] === '') {
    result += '\n';
  }
  return result;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function contentLineEnd(lines) {
  let end = lines.length;
  if (end > 0 && lines[end - 1] === '') end--;
  return end;
}

function validateSegments(lines) {
  const contentStart = 3;
  const contentEnd = contentLineEnd(lines);
  let expected = contentStart;
  for (const [, start, end] of SEGMENTS) {
    if (start !== expected) {
      throw new Error(`Gap or overlap: expected start ${expected}, got ${start}`);
    }
    if (end < start) throw new Error(`Invalid range ${start}-${end}`);
    expected = end + 1;
  }
  if (expected - 1 !== contentEnd) {
    throw new Error(`Segments end at ${expected - 1}, file has ${contentEnd} lines`);
  }
}

function buildCascadeMarkdown() {
  const rows = SEGMENTS.map(([file, start, end], i) => {
    const name = path.basename(file, '.css');
    return `| ${i + 1} | \`${file}\` | ${start}–${end} |`;
  }).join('\n');
  return `# CSS cascade order

Порядок \`@import\` в \`index.css\` **не менять** без проверки каскада.

| # | Файл | Исходные строки (монолит) |
|---|------|---------------------------|
${rows}

Эталон: \`styles/.snapshot-monolith.css\` (копия монолита до split).

Проверка: \`node scripts/verify-css-cascade.mjs\`
`;
}

function main() {
  const lines = readLines(monolithPath);
  if (!fs.existsSync(snapshotPath)) {
    ensureDir(snapshotPath);
    fs.copyFileSync(monolithPath, snapshotPath);
    console.log('Created snapshot:', snapshotPath);
  }

  validateSegments(lines);

  for (const [rel, start, end] of SEGMENTS) {
    const out = path.join(srcDir, rel);
    ensureDir(out);
    const content = sliceLines(lines, start, end);
    fs.writeFileSync(out, content + (content.endsWith('\n') ? '' : '\n'), 'utf8');
    console.log(`Wrote ${rel} (${end - start + 1} lines)`);
  }

  const imports = [
    '@import "tailwindcss";',
    '',
    ...SEGMENTS.map(([rel]) => `@import "./${rel.replace(/\\/g, '/')}";`),
    '',
  ].join('\n');
  fs.writeFileSync(monolithPath, imports, 'utf8');
  console.log('Wrote index.css with', SEGMENTS.length, 'imports');

  fs.writeFileSync(path.join(stylesDir, 'cascade-order.md'), buildCascadeMarkdown(), 'utf8');

  const readme = `# Frontend styles

Стили разбиты из монолитного \`index.css\`. **Порядок каскада** задан цепочкой \`@import\` в [\`../index.css\`](../index.css) — см. [cascade-order.md](./cascade-order.md).

## Куда добавлять новые стили

| Тип | Файл |
|-----|------|
| Токены / тема | \`tokens.css\` |
| Reset, body | \`base.css\` |
| Shell layout | \`layout/\` |
| Кнопки, формы, модалки | \`components/\` |
| Экран / фича | \`features/<feature>.css\` |
| Глобальный responsive | \`responsive/\` (осторожно с порядком) |

Правила именования: [ui-guidelines.md](../../../../docs/architecture/ui-guidelines.md) §6.

## Проверка после правок

\`\`\`bash
node scripts/verify-css-cascade.mjs
npm run build
npm test
\`\`\`
`;
  fs.writeFileSync(path.join(stylesDir, 'README.md'), readme, 'utf8');
  console.log('Done.');
}

main();
