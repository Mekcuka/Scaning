/**
 * Split a CSS file into parts by 1-based inclusive line ranges.
 * Usage: node scripts/split-css-file.mjs <src-relative-path> '<json-parts>'
 *
 * json-parts: [{ "out": "styles/features/map/foo.css", "start": 1, "end": 55 }, ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
}

function sliceLines(lines, start, end) {
  const chunk = lines.slice(start - 1, end);
  let result = chunk.join('\n');
  if (chunk.length > 0 && chunk[chunk.length - 1] === '') {
    result += '\n';
  }
  return result;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const rel = process.argv[2];
  const partsJson = process.argv[3];
  if (!rel || !partsJson) {
    console.error('Usage: node split-css-file.mjs <src-relative-path> \'<json-parts>\'');
    process.exit(1);
  }

  const inputPath = path.join(srcDir, rel);
  const lines = readLines(inputPath);
  const parts = JSON.parse(partsJson);

  let expected = 1;
  for (const part of parts) {
    if (part.start !== expected) {
      throw new Error(`Gap or overlap: expected start ${expected}, got ${part.start} for ${part.out}`);
    }
    if (part.end < part.start) throw new Error(`Invalid range for ${part.out}`);
    expected = part.end + 1;
  }
  const contentEnd = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
  if (expected - 1 !== contentEnd) {
    throw new Error(`Parts end at line ${expected - 1}, file has ${contentEnd} content lines`);
  }

  for (const part of parts) {
    const outPath = path.join(srcDir, part.out);
    ensureDir(outPath);
    const content = sliceLines(lines, part.start, part.end);
    fs.writeFileSync(outPath, content + (content.endsWith('\n') ? '' : '\n'), 'utf8');
    console.log(`Wrote ${part.out} (${part.end - part.start + 1} lines)`);
  }

  console.log('Manifest entries:');
  for (const part of parts) {
    console.log(`  '${part.out}',`);
  }
}

main();
