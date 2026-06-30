import fs from 'node:fs';
import path from 'node:path';

const file = path.join('src/pages/map/mapPageToolbar/MapPageToolbarDrawGroup.tsx');
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/\r\n\r\n/g, '\r\n');

if (!s.includes('MapToolbarButton')) {
  s = s.replace(
    "import { PointSubtypeMenuItem } from '../PointSubtypeMenuItem';",
    "import { PointSubtypeMenuItem } from '../PointSubtypeMenuItem';\nimport { MapToolbarButton } from './MapToolbarButton';",
  );
}

const replacements = [
  [
    /        <button\r?\n          type="button"\r?\n          className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label rounded-none border-0 \$\{\r?\n            drawMode === 'select' && selectMode === 'single' \? 'btn-primary active' : 'btn-secondary'\r?\n          \}`\}/g,
    '        <MapToolbarButton\n          active={drawMode === \'select\' && selectMode === \'single\'}\n          className="rounded-none border-0"',
  ],
  [
    /        <button\r?\n          type="button"\r?\n          className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label rounded-none border-0 \$\{\r?\n            drawMode === 'select' && selectMode === 'box' \? 'btn-primary active' : 'btn-secondary'\r?\n          \}`\}/g,
    '        <MapToolbarButton\n          active={drawMode === \'select\' && selectMode === \'box\'}\n          className="rounded-none border-0"',
  ],
  [
    /      <button\r?\n        type="button"\r?\n        className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'autoroad_network' \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '      <MapToolbarButton\n        active={drawMode === \'autoroad_network\'}',
  ],
  [
    /      <button\r?\n        type="button"\r?\n        className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'pad_placement' \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '      <MapToolbarButton\n        active={drawMode === \'pad_placement\'}',
  ],
  [
    /      <button\r?\n        type="button"\r?\n        className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'poi' \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '      <MapToolbarButton\n        active={drawMode === \'poi\'}',
  ],
  [
    /        <button\r?\n          type="button"\r?\n          className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{bottomholeActive \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '        <MapToolbarButton\n          active={bottomholeActive}',
  ],
  [
    /          <button\r?\n            type="button"\r?\n            className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'point' \|\| pointMenuOpen \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '          <MapToolbarButton\n            active={drawMode === \'point\' || pointMenuOpen}',
  ],
  [
    /          <button\r?\n            type="button"\r?\n            className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'line' \|\| lineMenuOpen \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '          <MapToolbarButton\n            active={drawMode === \'line\' || lineMenuOpen}',
  ],
  [
    /      <button\r?\n        type="button"\r?\n        className=\{`btn btn-sm map-tool-btn map-tool-btn--with-label \$\{drawMode === 'ruler' \? 'btn-primary active' : 'btn-secondary'\}`\}/g,
    '      <MapToolbarButton\n        active={drawMode === \'ruler\'}',
  ],
];

for (const [re, rep] of replacements) {
  const before = s;
  s = s.replace(re, rep);
  if (s === before) console.warn('no match for', rep.slice(0, 40));
}

// Close MapToolbarButton tags: after each MapToolbarButton opening, find next </button> that closes it
const lines = s.split('\n');
const out = [];
let inMapBtn = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<MapToolbarButton')) inMapBtn = true;
  if (inMapBtn && line.trim() === '</button>') {
    out.push(line.replace('</button>', '</MapToolbarButton>'));
    inMapBtn = false;
    continue;
  }
  out.push(line);
}
s = out.join('\n');

fs.writeFileSync(file, s);
console.log('migrated', file);
