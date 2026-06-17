/** Anti-collision (SF) visualization helpers for pad clustering 3D scene. */

import * as THREE from 'three';
import type { ClearancePair, WellTrajectory } from '../api/wellTrajectoryApi';
import { clearanceLineColorHex } from '../wellTrajectoryClearance';
import { stationToScenePoint } from './padClusteringScene3d';

export type SceneVec3 = { x: number; y: number; z: number };

export type ClearancePairApproach = {
  pairKey: string;
  wellA: number;
  wellB: number;
  minSf: number | null;
  warning: boolean;
  pointA: SceneVec3;
  pointB: SceneVec3;
  midpoint: SceneVec3;
};

function sub(a: SceneVec3, b: SceneVec3): SceneVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: SceneVec3, b: SceneVec3): SceneVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: SceneVec3, s: number): SceneVec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a: SceneVec3, b: SceneVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function distSq(a: SceneVec3, b: SceneVec3): number {
  const d = sub(a, b);
  return dot(d, d);
}

export function closestPointsOnSegments(
  p1: SceneVec3,
  q1: SceneVec3,
  p2: SceneVec3,
  q2: SceneVec3,
): { p1: SceneVec3; p2: SceneVec3; distSq: number } {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  let s = 0;
  let t = 0;

  if (a <= 1e-12 && e <= 1e-12) {
    return { p1, p2, distSq: distSq(p1, p2) };
  }
  if (a <= 1e-12) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = dot(d1, r);
    if (e <= 1e-12) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      const tnom = b * s + f;
      t = Math.max(0, Math.min(1, tnom / e));
      if (tnom < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (tnom > e) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  const cp1 = add(p1, scale(d1, s));
  const cp2 = add(p2, scale(d2, t));
  return { p1: cp1, p2: cp2, distSq: distSq(cp1, cp2) };
}

function trajectoryScenePoints(well: WellTrajectory, kbM: number): SceneVec3[] {
  const stations = well.survey?.stations ?? [];
  const points: SceneVec3[] = [];
  for (const st of stations) {
    const e = Number(st.e ?? 0);
    const n = Number(st.n ?? 0);
    const tvd = Number(st.tvd ?? 0);
    if (!Number.isFinite(e) || !Number.isFinite(n) || !Number.isFinite(tvd)) continue;
    points.push(stationToScenePoint(e, n, tvd, kbM));
  }
  return points;
}

export function closestApproachBetweenTrajectories(
  wellA: WellTrajectory,
  wellB: WellTrajectory,
  kbM: number,
): { pointA: SceneVec3; pointB: SceneVec3 } | null {
  const a = trajectoryScenePoints(wellA, kbM);
  const b = trajectoryScenePoints(wellB, kbM);
  if (a.length === 0 || b.length === 0) return null;

  let minDistSq = Infinity;
  let bestA = a[0]!;
  let bestB = b[0]!;

  for (const pa of a) {
    for (const pb of b) {
      const d = distSq(pa, pb);
      if (d < minDistSq) {
        minDistSq = d;
        bestA = pa;
        bestB = pb;
      }
    }
  }

  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      const hit = closestPointsOnSegments(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!);
      if (hit.distSq < minDistSq) {
        minDistSq = hit.distSq;
        bestA = hit.p1;
        bestB = hit.p2;
      }
    }
  }

  return { pointA: bestA, pointB: bestB };
}

function findTrajectory(trajectories: WellTrajectory[], wellIndex: number): WellTrajectory | null {
  return trajectories.find((t) => (t.well_index ?? -1) === wellIndex) ?? null;
}

export function collectClearancePairApproaches(
  trajectories: WellTrajectory[],
  clearancePairs: ClearancePair[],
  kbM: number,
  options: { warningsOnly?: boolean } = {},
): ClearancePairApproach[] {
  const { warningsOnly = true } = options;
  const out: ClearancePairApproach[] = [];

  for (const pair of clearancePairs) {
    if (warningsOnly && !pair.warning) continue;
    const trajA = findTrajectory(trajectories, pair.well_a);
    const trajB = findTrajectory(trajectories, pair.well_b);
    if (!trajA || !trajB) continue;
    const approach = closestApproachBetweenTrajectories(trajA, trajB, kbM);
    if (!approach) continue;
    const midpoint = {
      x: (approach.pointA.x + approach.pointB.x) / 2,
      y: (approach.pointA.y + approach.pointB.y) / 2,
      z: (approach.pointA.z + approach.pointB.z) / 2,
    };
    out.push({
      pairKey: `${pair.well_a}-${pair.well_b}`,
      wellA: pair.well_a,
      wellB: pair.well_b,
      minSf: pair.min_sf,
      warning: pair.warning,
      pointA: approach.pointA,
      pointB: approach.pointB,
      midpoint,
    });
  }

  return out;
}

export function clearancePairsSceneRevision(clearancePairs: ClearancePair[]): string {
  return clearancePairs
    .map((p) => `${p.well_a}:${p.well_b}:${p.min_sf ?? ''}:${p.warning ? 1 : 0}`)
    .join('|');
}

export function buildClearancePairLines(
  trajectories: WellTrajectory[],
  clearancePairs: ClearancePair[],
  kbM: number,
  sfWarningThreshold: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'layer-clearance-pairs';

  const approaches = collectClearancePairApproaches(trajectories, clearancePairs, kbM, {
    warningsOnly: true,
  });

  for (const item of approaches) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(item.pointA.x, item.pointA.y, item.pointA.z),
      new THREE.Vector3(item.pointB.x, item.pointB.y, item.pointB.z),
    ]);
    const color = clearanceLineColorHex(item.minSf, sfWarningThreshold);
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 3,
      gapSize: 2,
      linewidth: 1,
      transparent: true,
      opacity: 0.92,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.userData = {
      pairKey: item.pairKey,
      wellA: item.wellA,
      wellB: item.wellB,
      minSf: item.minSf,
    };
    group.add(line);
  }

  return group;
}
