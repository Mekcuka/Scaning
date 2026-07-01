/**
 * One-time migration: co-located *.test.* → __tests__/ subfolders.
 * Run from decision-matrix/frontend: node scripts/move-tests-to-__tests__.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(frontendRoot, 'src');
const testRe = /\.(test|spec)\.(ts|tsx)$/;

function isShim(content) {
  return /^export\s+\*\s+from\s+['"][^'"]+['"];?\s*$/s.test(content.trim());
}

function bumpRelative(spec) {
  if (spec.startsWith('./')) return `../${spec.slice(2)}`;
  if (spec.startsWith('../')) return `../${spec}`;
  return spec;
}

function fixRelativeImports(content) {
  const re =
    /(\bfrom\s+|\bimport\s*\(\s*|vi\.mock\s*\(\s*|vi\.unmock\s*\(\s*)(['"])(\.\.?\/[^'"]+)(['"])/g;
  return content.replace(re, (_m, prefix, q1, spec, q2) => {
    return `${prefix}${q1}${bumpRelative(spec)}${q2}`;
  });
}

function walkTests(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__') continue;
      if (path.relative(srcRoot, full) === 'test') continue;
      walkTests(full, files);
    } else if (testRe.test(ent.name)) {
      const rel = path.relative(srcRoot, full);
      if (rel.startsWith(`test${path.sep}`)) continue;
      files.push(full);
    }
  }
  return files;
}

const allTests = walkTests(srcRoot);
const shims = [];
const toMove = [];

for (const file of allTests) {
  const content = fs.readFileSync(file, 'utf8');
  if (isShim(content)) {
    shims.push(file);
  } else {
    toMove.push(file);
  }
}

let moved = 0;
for (const file of toMove) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  const destDir = path.join(dir, '__tests__');
  const dest = path.join(destDir, base);
  if (file === dest) continue;
  fs.mkdirSync(destDir, { recursive: true });
  const content = fixRelativeImports(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(dest, content, 'utf8');
  fs.unlinkSync(file);
  moved += 1;
}

let deletedShims = 0;
for (const file of shims) {
  fs.unlinkSync(file);
  deletedShims += 1;
}

console.log(`Moved ${moved} test files into __tests__/`);
console.log(`Deleted ${deletedShims} re-export shim files`);
