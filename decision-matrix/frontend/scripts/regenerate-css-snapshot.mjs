import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENTS } from './css-segments.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');
const snapPath = path.join(srcDir, 'styles', '.snapshot-monolith.css');

const parts = SEGMENTS.map((rel) => fs.readFileSync(path.join(srcDir, rel), 'utf8').replace(/\r\n/g, '\n'));
const combined = parts.join('');
const header = '@import "tailwindcss";\n\n';
fs.writeFileSync(snapPath, header + combined);
console.log(`Regenerated ${snapPath} (${combined.length} chars, ${SEGMENTS.length} segments)`);
