import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { MAP3D_POWER_LINE_TOWER_SCALE, scaleMap3dMeters } from './map3dConfig';
import {
  powerLineVertexHasTower,
  type PowerLineWireEndpoint,
} from './map3dPowerLineEndpoints';
import {
  createPowerLineGlowMaterial,
  createPowerLineMetalMaterial,
  createPowerLineWireMaterial,
} from './map3dPowerLineStyle';

function hexToThreeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color('#888888');
  }
}

function vertexToLocalMeters(
  anchor: maplibregl.MercatorCoordinate,
  lon: number,
  lat: number,
  altM: number,
): THREE.Vector3 {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altM);
  const m = anchor.meterInMercatorCoordinateUnits();
  return new THREE.Vector3((mc.x - anchor.x) / m, (mc.z - anchor.z) / m, -(mc.y - anchor.y) / m);
}

/** Lattice transmission tower; local Y = up, base at y=0. `towerHeightM` already includes MAP3D_OBJECT_SCALE. */
export function buildTransmissionTowerMesh(
  towerHeightM: number,
  _color: THREE.Color,
  selected: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(towerHeightM, scaleMap3dMeters(8));
  const spread = h * 0.11;
  const legW = h * 0.018;
  const legMat = createPowerLineMetalMaterial(selected);
  const armMat = createPowerLineGlowMaterial(selected);
  const insMat = createPowerLineGlowMaterial(selected);

  const legGeo = new THREE.BoxGeometry(legW, h * 0.88, legW);
  const corners: [number, number][] = [
    [-spread, -spread],
    [spread, -spread],
    [spread, spread],
    [-spread, spread],
  ];
  for (const [cx, cz] of corners) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(cx, h * 0.44, cz);
    g.add(leg);
  }

  const lattice = new THREE.Mesh(
    new THREE.CylinderGeometry(spread * 0.35, spread * 1.05, h * 0.82, 4),
    legMat,
  );
  lattice.position.y = h * 0.41;
  g.add(lattice);

  const armY = h * 0.9;
  const armLen = h * 0.38;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, legW * 1.4, legW * 2.2), armMat);
  arm.position.y = armY;
  g.add(arm);

  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(legW * 2.2, legW * 1.4, armLen * 0.55),
    armMat,
  );
  cross.position.y = armY;
  g.add(cross);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ins = new THREE.Mesh(
        new THREE.SphereGeometry(h * 0.025, 8, 8),
        insMat,
      );
      ins.position.set(sx * armLen * 0.42, armY + h * 0.02, sz * armLen * 0.18);
      g.add(ins);
    }
  }

  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(spread * 0.2, h * 0.08, 4),
    armMat,
  );
  peak.position.y = h * 0.96;
  g.add(peak);

  return g;
}

export { POWER_LINE_TOWER_GLTF_ID } from './map3dPowerLineStyle';

const WIRE_COUNT = 3;

function wireOffsetIndex(i: number): number {
  return i - (WIRE_COUNT - 1) / 2;
}

export type PowerLineBuildInput = {
  path: [number, number][];
  alts: number[];
  startWire: PowerLineWireEndpoint;
  finishWire: PowerLineWireEndpoint;
  colorHex: string;
  opacity: number;
  towerHeightM: number;
  selected: boolean;
  /** Tests: procedural towers; production uses glTF via lines layer. */
  towerMode?: 'gltf' | 'procedural';
};

export type PowerLineTowerSlot = {
  vertexIndex: number;
  position: THREE.Vector3;
};

export type PowerLineBuildResult = {
  group: THREE.Group;
  anchorLon: number;
  anchorLat: number;
  anchorAlt: number;
  towerH: number;
  towerSlots: PowerLineTowerSlot[];
};

function wirePointFromEndpoint(
  anchor: maplibregl.MercatorCoordinate,
  ep: PowerLineWireEndpoint,
): THREE.Vector3 {
  return vertexToLocalMeters(anchor, ep.lon, ep.lat, ep.altM);
}

function wirePointFromTower(
  towerPos: THREE.Vector3,
  towerH: number,
  wireAttachFrac: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    towerPos.x,
    towerPos.y + towerH * wireAttachFrac,
    towerPos.z,
  );
}

export function createPowerLineGroup(input: PowerLineBuildInput): PowerLineBuildResult | null {
  const {
    path,
    alts,
    startWire,
    finishWire,
    colorHex,
    opacity,
    towerHeightM,
    selected,
    towerMode = 'gltf',
  } = input;
  if (path.length < 2) return null;

  const towerH =
    scaleMap3dMeters(Math.max(8, towerHeightM)) * MAP3D_POWER_LINE_TOWER_SCALE;
  const wireRadius = scaleMap3dMeters(0.12);
  const wireSpan = scaleMap3dMeters(2.2);
  const wireAttachFrac = 0.9;

  const anchorLon = path[0]![0];
  const anchorLat = path[0]![1];
  const anchorAlt = alts[0] ?? 0;
  const anchor = maplibregl.MercatorCoordinate.fromLngLat([anchorLon, anchorLat], anchorAlt);

  const root = new THREE.Group();
  const wireMat = createPowerLineWireMaterial(opacity, selected);

  const towerPositions = path.map((p, i) =>
    vertexToLocalMeters(anchor, p[0], p[1], alts[i] ?? anchorAlt),
  );

  const n = towerPositions.length;
  const towerSlots: PowerLineTowerSlot[] = [];
  for (let vi = 0; vi < n; vi++) {
    if (!powerLineVertexHasTower(vi, n)) continue;
    const pos = towerPositions[vi]!;
    if (towerMode === 'procedural') {
      const tower = buildTransmissionTowerMesh(
        towerH,
        hexToThreeColor(colorHex),
        selected,
      );
      tower.position.copy(pos);
      root.add(tower);
    } else {
      towerSlots.push({ vertexIndex: vi, position: pos.clone() });
    }
  }

  const wireAt = (vertexIndex: number): THREE.Vector3 => {
    if (vertexIndex === 0) return wirePointFromEndpoint(anchor, startWire);
    if (vertexIndex === n - 1) return wirePointFromEndpoint(anchor, finishWire);
    return wirePointFromTower(towerPositions[vertexIndex]!, towerH, wireAttachFrac);
  };

  for (let seg = 0; seg < path.length - 1; seg++) {
    const topA = wireAt(seg);
    const topB = wireAt(seg + 1);

    const dx = topB.x - topA.x;
    const dz = topB.z - topA.z;
    const len = Math.hypot(dx, dz) || 1;
    const perpX = -dz / len;
    const perpZ = dx / len;

    for (let w = 0; w < WIRE_COUNT; w++) {
      const off = wireOffsetIndex(w) * wireSpan;
      const start = new THREE.Vector3(
        topA.x + perpX * off,
        topA.y,
        topA.z + perpZ * off,
      );
      const end = new THREE.Vector3(
        topB.x + perpX * off,
        topB.y,
        topB.z + perpZ * off,
      );
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y -= len * 0.04;

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const segments = Math.max(8, Math.min(32, Math.ceil(len / 8)));
      const geom = new THREE.TubeGeometry(curve, segments, wireRadius, 6, false);
      const mesh = new THREE.Mesh(geom, wireMat);
      root.add(mesh);
    }
  }

  return { group: root, anchorLon, anchorLat, anchorAlt, towerH, towerSlots };
}
