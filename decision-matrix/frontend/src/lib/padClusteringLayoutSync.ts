import type { PadClusteringPadDraft } from './padClusteringSave';
import {
  isPlanPolygon,
  type PadWellLayoutResult,
  type PlanShapeSketch,
  type PlanVertex,
} from './padEarthworkSketch';

const MATCH_TOL_M = 0.05;

export function parsePadWellCountFromDraft(draft: PadClusteringPadDraft): number | null {
  const t = draft.padWellCount.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

export function wellsLocalMatch(a: PlanVertex[], b: PlanVertex[], tolM = MATCH_TOL_M): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (Math.abs(left.east_m - right.east_m) > tolM) return false;
    if (Math.abs(left.north_m - right.north_m) > tolM) return false;
  }
  return true;
}

function polygonVerticesMatch(a: PlanVertex[], b: PlanVertex[], tolM = MATCH_TOL_M): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (Math.abs(left.east_m - right.east_m) > tolM) return false;
    if (Math.abs(left.north_m - right.north_m) > tolM) return false;
  }
  return true;
}

/** Saved sketch + wells disagree with what the sidebar layout params would generate. */
export function isPersistedLayoutStale(
  savedWells: PlanVertex[],
  savedSketch: PlanShapeSketch | null,
  preview: PadWellLayoutResult | null,
): boolean {
  if (!preview) return false;
  if (!wellsLocalMatch(savedWells, preview.wellsLocal)) return true;
  if (!savedSketch) return true;
  if (preview.sketch.kind === 'plan_polygon' && isPlanPolygon(savedSketch)) {
    return !polygonVerticesMatch(savedSketch.vertices, preview.sketch.vertices);
  }
  return false;
}
