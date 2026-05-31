import * as THREE from 'three';
import { buildLineCurveFromPoints, pathToLocalMeters } from './map3dLineMeshes';

/** Horizontal (XZ in local meters) distance between two points. */
export function planDistanceM(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/** Min distance from point P to polyline segments in plan (XZ). */
export function minDistanceToPolylineM(p: THREE.Vector3, polyline: THREE.Vector3[]): number {
  if (polyline.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / (ab.lengthSq() || 1)));
    const proj = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    best = Math.min(best, planDistanceM(p, proj));
  }
  return best;
}

const SAMPLE_STEPS_PER_SEGMENT = 8;

/** Sample 3D tube centerline in local meters (same curve as createLineTubeGroup). */
export function sampleTubeCenterlineLocal(
  path: [number, number][],
  alts: number[],
): THREE.Vector3[] | null {
  const built = pathToLocalMeters(path, alts);
  if (!built) return null;
  const curve = buildLineCurveFromPoints(built.points);
  const out: THREE.Vector3[] = [];
  const steps = Math.max(2, (path.length - 1) * SAMPLE_STEPS_PER_SEGMENT);
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    curve.getPoint(i / steps, tmp);
    out.push(tmp.clone());
  }
  return out;
}

/** Max plan distance from each path vertex to the sampled tube centerline. */
export function maxVertexDeviationFromTubeM(
  path: [number, number][],
  alts: number[],
): number {
  const samples = sampleTubeCenterlineLocal(path, alts);
  if (!samples) return Number.POSITIVE_INFINITY;
  const built = pathToLocalMeters(path, alts);
  if (!built) return Number.POSITIVE_INFINITY;
  let max = 0;
  for (const p of built.points) {
    max = Math.max(max, minDistanceToPolylineM(p, samples));
  }
  return max;
}

/**
 * For a 3-vertex path, middle vertex should lie on the tube centerline (not bulge opposite).
 * Returns plan distance from middle vertex to nearest centerline sample.
 */
export function middleVertexTubeDeviationM(
  path: [number, number][],
  alts: number[],
): number {
  if (path.length !== 3) return Number.POSITIVE_INFINITY;
  const samples = sampleTubeCenterlineLocal(path, alts);
  const built = pathToLocalMeters(path, alts);
  if (!samples || !built) return Number.POSITIVE_INFINITY;
  return minDistanceToPolylineM(built.points[1]!, samples);
}

/** Signed side of point in XZ relative to directed segment a→b (positive = left). */
function signedSideXZ(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
}

/**
 * Catmull-Rom bulge at an interior corner goes to the opposite side of chord A→C from B.
 * Straight segments keep samples near B (same side as B relative to chord).
 */
export function interiorCornerBulgesOppositeToChord(
  path: [number, number][],
  alts: number[],
): boolean {
  if (path.length !== 3) return false;
  const built = pathToLocalMeters(path, alts);
  const samples = sampleTubeCenterlineLocal(path, alts);
  if (!built || !samples) return false;
  const a = built.points[0]!;
  const b = built.points[1]!;
  const c = built.points[2]!;
  const sideB = signedSideXZ(b, a, c);
  if (Math.abs(sideB) < 1e-6) return false;

  const midIdx = Math.floor(samples.length / 2);
  const window = samples.slice(
    Math.max(0, midIdx - SAMPLE_STEPS_PER_SEGMENT),
    Math.min(samples.length, midIdx + SAMPLE_STEPS_PER_SEGMENT),
  );
  let opposite = 0;
  for (const s of window) {
    if (sideB > 0 ? signedSideXZ(s, a, c) < 0 : signedSideXZ(s, a, c) > 0) opposite++;
  }
  return opposite > window.length / 2;
}
