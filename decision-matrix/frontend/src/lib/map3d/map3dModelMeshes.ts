import * as THREE from 'three';
import type { Map3dMeshTemplate } from './map3dModelCatalog';
import { buildObjectColorPalette } from './map3dObjectPalette';

const CYL_SEGMENTS = 20;
const SPHERE_SEGMENTS = 16;

type ModelMaterials = {
  body: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  pad: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
};

function createModelMaterials(colorHex: string, selected: boolean): ModelMaterials {
  const p = buildObjectColorPalette(colorHex);
  const emissiveIntensity = selected ? 0.22 : 0.08;

  const mk = (color: THREE.Color, roughness: number, metalness: number) =>
    new THREE.MeshStandardMaterial({
      color: color.clone(),
      roughness,
      metalness,
      emissive: color.clone(),
      emissiveIntensity,
      side: THREE.FrontSide,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });

  return {
    pad: mk(p.pad, 0.9, 0.02),
    body: mk(p.body, 0.62, 0.1),
    roof: mk(p.roof, 0.78, 0.08),
    accent: mk(p.accent, 0.45, 0.28),
    trim: mk(p.trim, 0.55, 0.12),
  };
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  y: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

function buildFacility(group: THREE.Group, h: number, foot: number, m: ModelMaterials): void {
  const padH = h * 0.06;
  addMesh(
    group,
    new THREE.BoxGeometry(foot * 1.12, padH, foot * 1.05),
    m.pad,
    padH / 2,
  );

  const bodyH = h * 0.68;
  addMesh(
    group,
    new THREE.BoxGeometry(foot, bodyH, foot * 0.88),
    m.body,
    padH + bodyH / 2,
  );

  const annex = new THREE.Mesh(
    new THREE.BoxGeometry(foot * 0.42, bodyH * 0.55, foot * 0.38),
    m.body.clone(),
  );
  annex.position.set(foot * 0.38, padH + bodyH * 0.3, foot * 0.22);
  group.add(annex);

  const roofH = h * 0.14;
  addMesh(
    group,
    new THREE.BoxGeometry(foot * 0.92, roofH, foot * 0.72),
    m.roof,
    padH + bodyH + roofH / 2,
  );

  const stackH = h * 0.22;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.08, foot * 0.11, stackH, CYL_SEGMENTS),
    m.accent,
    padH + bodyH + roofH + stackH / 2,
  );
}

function buildTallStack(group: THREE.Group, h: number, foot: number, m: ModelMaterials): void {
  const padH = h * 0.08;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.55, foot * 0.62, padH, CYL_SEGMENTS),
    m.pad,
    padH / 2,
  );

  const baseH = h * 0.18;
  addMesh(
    group,
    new THREE.BoxGeometry(foot * 0.75, baseH, foot * 0.75),
    m.body,
    padH + baseH / 2,
  );

  const stackH = h * 0.68;
  const stackY = padH + baseH + stackH / 2;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.12, foot * 0.2, stackH, CYL_SEGMENTS),
    m.body,
    stackY,
  );

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(foot * 0.16, foot * 0.025, 8, CYL_SEGMENTS),
    m.accent,
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = stackY + stackH * 0.15;
  group.add(band);

  addMesh(
    group,
    new THREE.SphereGeometry(foot * 0.1, SPHERE_SEGMENTS, 12),
    m.trim,
    padH + baseH + stackH + foot * 0.1,
  );
}

function buildNode(group: THREE.Group, h: number, foot: number, m: ModelMaterials): void {
  const padH = h * 0.1;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.5, foot * 0.55, padH, CYL_SEGMENTS),
    m.pad,
    padH / 2,
  );

  const plinthH = h * 0.15;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.38, foot * 0.42, plinthH, CYL_SEGMENTS),
    m.body,
    padH + plinthH / 2,
  );

  const tankR = foot * 0.36;
  addMesh(
    group,
    new THREE.SphereGeometry(tankR, SPHERE_SEGMENTS, 14),
    m.body,
    padH + plinthH + tankR,
  );

  const valveH = h * 0.12;
  addMesh(
    group,
    new THREE.BoxGeometry(foot * 0.22, valveH, foot * 0.18),
    m.accent,
    padH + plinthH + tankR * 2 + valveH / 2,
  );
}

function buildQuarry(group: THREE.Group, h: number, foot: number, m: ModelMaterials): void {
  const steps = 4;
  const stepH = (h * 0.38) / steps;
  let y = stepH / 2;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r0 = foot * (1.05 - t * 0.35);
    const r1 = foot * (0.95 - t * 0.35);
    addMesh(
      group,
      new THREE.CylinderGeometry(r0, r1, stepH, CYL_SEGMENTS),
      i === 0 ? m.pad : m.body,
      y,
    );
    y += stepH;
  }
}

function buildPoiPin(group: THREE.Group, h: number, foot: number, m: ModelMaterials): void {
  const stemH = h * 0.42;
  addMesh(
    group,
    new THREE.CylinderGeometry(foot * 0.06, foot * 0.09, stemH, 12),
    m.pad,
    stemH / 2,
  );

  const coneH = h * 0.38;
  addMesh(
    group,
    new THREE.ConeGeometry(foot * 0.28, coneH, CYL_SEGMENTS),
    m.body,
    stemH + coneH / 2,
  );

  addMesh(
    group,
    new THREE.SphereGeometry(foot * 0.2, SPHERE_SEGMENTS, 14),
    m.trim,
    stemH + coneH + foot * 0.2,
  );
}

function buildPrototype(
  template: Map3dMeshTemplate,
  heightM: number,
  footprintScale: number,
  colorHex: string,
  selected: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const m = createModelMaterials(colorHex, selected);
  const h = Math.max(2, heightM);
  const foot = Math.max(4, h * 0.35 * footprintScale);

  switch (template) {
    case 'facility':
      buildFacility(group, h, foot, m);
      break;
    case 'tall_stack':
      buildTallStack(group, h, foot, m);
      break;
    case 'node':
      buildNode(group, h, foot, m);
      break;
    case 'quarry':
      buildQuarry(group, h, foot, m);
      break;
    case 'poi_pin':
      buildPoiPin(group, h, foot, m);
      break;
    default:
      break;
  }

  return group;
}

const meshCache = new Map<string, THREE.Group>();
const CACHE_MAX = 128;

function cacheKey(
  template: Map3dMeshTemplate,
  heightM: number,
  footprintScale: number,
  colorHex: string,
  selected: boolean,
): string {
  return `${template}|${Math.round(heightM)}|${footprintScale.toFixed(2)}|${colorHex}|${selected ? 1 : 0}`;
}

function trimCache(): void {
  if (meshCache.size <= CACHE_MAX) return;
  const first = meshCache.keys().next().value;
  if (first) meshCache.delete(first);
}

/** Cached prototype clone — geometry/material shared, safe for read-only rendering. */
export function createProceduralModelMesh(
  template: Map3dMeshTemplate,
  heightM: number,
  footprintScale: number,
  colorHex: string,
  selected = false,
): THREE.Group {
  const key = cacheKey(template, heightM, footprintScale, colorHex, selected);
  let proto = meshCache.get(key);
  if (!proto) {
    proto = buildPrototype(template, heightM, footprintScale, colorHex, selected);
    meshCache.set(key, proto);
    trimCache();
  }
  return proto.clone();
}

/** For tests / hot reload. */
export function clearProceduralModelMeshCache(): void {
  meshCache.clear();
}
