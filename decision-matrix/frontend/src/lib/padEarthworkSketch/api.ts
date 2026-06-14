import { clampLength, clampRotation, clampWidth, parseRotation } from './clamp';
import { polygonFootprintAreaM2, snapVertex } from './polygon';
import { createDefaultPlanSketch, planFootprintAreaM2 } from './rectangle';
import {
  isPlanPolygon,
  MIN_POLYGON_VERTICES,
  type PlanShapeSketch,
  type PlanVertex,
} from './types';

export function sketchFootprintAreaM2(sketch: PlanShapeSketch): number {
  return isPlanPolygon(sketch) ? polygonFootprintAreaM2(sketch) : planFootprintAreaM2(sketch);
}

export function estimateFillM3(sketch: PlanShapeSketch, heightM: number): number | null {
  if (!Number.isFinite(heightM) || heightM <= 0) return null;
  return sketchFootprintAreaM2(sketch) * heightM;
}

export function sketchToApiPayload(sketch: PlanShapeSketch): PlanShapeSketch {
  if (isPlanPolygon(sketch)) {
    return {
      kind: 'plan_polygon',
      vertices: sketch.vertices.map((v) => snapVertex(v, 0)),
    };
  }
  return {
    kind: 'plan_rectangle',
    length_m: clampLength(sketch.length_m),
    width_m: clampWidth(sketch.width_m),
    rotation_deg: clampRotation(sketch.rotation_deg),
  };
}

export function parseSketchFromLast(raw: unknown): PlanShapeSketch | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'plan_polygon') {
    const verts = o.vertices;
    if (!Array.isArray(verts) || verts.length < MIN_POLYGON_VERTICES) return null;
    const vertices: PlanVertex[] = [];
    for (const item of verts) {
      if (!item || typeof item !== 'object') return null;
      const v = item as Record<string, unknown>;
      const east = Number(v.east_m);
      const north = Number(v.north_m);
      if (!Number.isFinite(east) || !Number.isFinite(north)) return null;
      vertices.push({ east_m: east, north_m: north });
    }
    return { kind: 'plan_polygon', vertices };
  }
  if (o.kind !== 'plan_rectangle') return null;
  const length = Number(o.length_m);
  const width = Number(o.width_m);
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0) {
    return null;
  }
  return createDefaultPlanSketch(length, width, parseRotation(String(o.rotation_deg ?? 0)));
}

export function parseWellsLocalFromLast(raw: unknown): PlanVertex[] {
  if (!Array.isArray(raw)) return [];
  const wells: PlanVertex[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    const east = Number(v.east_m);
    const north = Number(v.north_m);
    if (!Number.isFinite(east) || !Number.isFinite(north)) continue;
    wells.push({ east_m: east, north_m: north });
  }
  return wells;
}
