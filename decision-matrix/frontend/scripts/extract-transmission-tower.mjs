/**
 * One-off: extract Tower_1 from iPoly3D "Lowpoly Electric Towers" (CC0).
 * Source zip: https://ipoly3d.com/assets/lowpoly-electric-towers/
 */
import { NodeIO } from '@gltf-transform/core';
import { flatten, prune } from '@gltf-transform/functions';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../public/map3d-models');
const input = path.join(root, '_ipoly-temp/electric-towers.gltf');
const output = path.join(root, 'transmission-tower.glb');

const io = new NodeIO();
const document = await io.read(input);
const scene = document.getRoot().getDefaultScene();
if (!scene) throw new Error('No default scene');

for (const child of [...scene.listChildren()]) {
  if (child.getName() !== 'Tower_1') child.dispose();
}

await document.transform(prune(), flatten());
await io.write(output, document);
console.log('Wrote', output);
