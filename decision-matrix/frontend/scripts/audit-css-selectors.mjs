/**
 * Find CSS selectors duplicated across style segment files.
 * Output: src/styles/css-audit-report.md (generated; do not commit).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesDir = path.resolve(__dirname, '../src/styles');
const outPath = path.join(stylesDir, 'css-audit-report.md');

const SKIP = new Set(['.snapshot-monolith.css', 'css-audit-report.md']);

function walkCss(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkCss(full, acc);
    else if (ent.name.endsWith('.css') && !SKIP.has(ent.name)) acc.push(full);
  }
  return acc;
}

function normalizeSelector(sel) {
  return sel.replace(/\s+/g, ' ').trim();
}

function parseRules(css) {
  const rules = [];
  let i = 0;
  let mediaStack = [''];

  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (css.slice(i, i + 6) === '@media') {
      const open = css.indexOf('{', i);
      const header = css.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      const inner = [];
      let chunk = '';
      while (j < css.length && depth > 0) {
        const ch = css[j];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
        chunk += ch;
        j++;
      }
      mediaStack.push(header);
      rules.push(...parseRules(chunk));
      mediaStack.pop();
      i = j + 1;
      continue;
    }
    if (css[i] === '}') {
      i++;
      continue;
    }
    if (css[i] === '@') {
      const semi = css.indexOf(';', i);
      const brace = css.indexOf('{', i);
      if (brace !== -1 && (semi === -1 || brace < semi)) {
        let depth = 1;
        let j = brace + 1;
        while (j < css.length && depth > 0) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}') depth--;
          j++;
        }
        i = j;
        continue;
      }
      i = semi === -1 ? css.length : semi + 1;
      continue;
    }
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const selectorPart = css.slice(i, open).trim();
    if (selectorPart && !selectorPart.startsWith('@')) {
      for (const sel of selectorPart.split(',')) {
        const s = normalizeSelector(sel);
        if (s) {
          rules.push({ selector: s, media: mediaStack[mediaStack.length - 1] || '(base)' });
        }
      }
    }
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return rules;
}

const files = walkCss(stylesDir);
const bySelector = new Map();

for (const file of files) {
  const rel = path.relative(path.resolve(__dirname, '../src'), file).replace(/\\/g, '/');
  const rules = parseRules(fs.readFileSync(file, 'utf8'));
  for (const rule of rules) {
    const key = `${rule.media}|||${rule.selector}`;
    if (!bySelector.has(key)) bySelector.set(key, new Set());
    bySelector.get(key).add(rel);
  }
}

const dupes = [...bySelector.entries()]
  .filter(([, fileSet]) => fileSet.size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

const lines = [
  '# CSS audit report (generated)',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Scanned ${files.length} files. Duplicate selector occurrences: **${dupes.length}**.`,
  '',
  '| Media | Selector | Files |',
  '|-------|----------|-------|',
];

for (const [key, fileSet] of dupes) {
  const [media, selector] = key.split('|||');
  const filesList = [...fileSet].sort().join(', ');
  lines.push(`| \`${media}\` | \`${selector}\` | ${filesList} |`);
}

fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outPath} (${dupes.length} duplicate selector keys)`);
