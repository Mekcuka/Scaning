import { clampLength, clampWidth } from './clamp';
import { createDefaultPlanSketch, rectangleToPolygon } from './rectangle';
import {
  DEFAULT_PLAN_LENGTH_M,
  DEFAULT_PLAN_WIDTH_M,
  MAX_POLYGON_VERTICES,
  MIN_POLYGON_VERTICES,
  snapMeters,
  type PlanPolygonSketch,
  type PlanRectangleSketch,
  type PlanVertex,
} from './types';

export function polygonFootprintAreaM2(sketch: PlanPolygonSketch): number {
  return polygonAreaM2(sketch.vertices);
}

export function polygonAreaM2(vertices: PlanVertex[]): number {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    area += vertices[i].east_m * vertices[j].north_m;
    area -= vertices[j].east_m * vertices[i].north_m;
  }
  return Math.abs(area) / 2;
}

export function polygonEdgeLengthM(a: PlanVertex, b: PlanVertex): number {
  return Math.hypot(b.east_m - a.east_m, b.north_m - a.north_m);
}

export function polygonPerimeterM(vertices: PlanVertex[]): number {
  if (vertices.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const j = (i + 1) % vertices.length;
    perimeter += polygonEdgeLengthM(vertices[i], vertices[j]);
  }
  return perimeter;
}

export type PolygonEdgeLabel = {
  east_m: number;
  north_m: number;
  length_m: number;
};

/** Midpoints and lengths for polygon edges (open chain or closed contour). */
export function polygonEdgeLabels(
  vertices: PlanVertex[],
  options?: { closed?: boolean; labelOffsetM?: number },
): PolygonEdgeLabel[] {
  if (vertices.length < 2) return [];
  const closed = options?.closed ?? vertices.length >= MIN_POLYGON_VERTICES;
  const edgeCount = closed ? vertices.length : vertices.length - 1;
  const offsetM = options?.labelOffsetM ?? 0;
  const centroid =
    vertices.length > 0
      ? {
          east_m: vertices.reduce((sum, v) => sum + v.east_m, 0) / vertices.length,
          north_m: vertices.reduce((sum, v) => sum + v.north_m, 0) / vertices.length,
        }
      : { east_m: 0, north_m: 0 };
  const labels: PolygonEdgeLabel[] = [];
  for (let i = 0; i < edgeCount; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const length_m = polygonEdgeLengthM(a, b);
    if (length_m < 1e-9) continue;
    const midEast = (a.east_m + b.east_m) / 2;
    const midNorth = (a.north_m + b.north_m) / 2;
    let east_m = midEast;
    let north_m = midNorth;
    if (offsetM > 0) {
      const dx = b.east_m - a.east_m;
      const dy = b.north_m - a.north_m;
      const edgeLen = Math.hypot(dx, dy) || 1;
      let nx = -dy / edgeLen;
      let ny = dx / edgeLen;
      if ((midEast + nx - centroid.east_m) * nx + (midNorth + ny - centroid.north_m) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      east_m = midEast + nx * offsetM;
      north_m = midNorth + ny * offsetM;
    }
    labels.push({ east_m, north_m, length_m });
  }
  return labels;
}

export function formatPlanEdgeLengthM(lengthM: number): string {
  const rounded = Math.round(lengthM * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
    : rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function polygonBoundingBox(vertices: PlanVertex[]): {
  length_m: number;
  width_m: number;
} {
  if (vertices.length === 0) {
    return { length_m: DEFAULT_PLAN_LENGTH_M, width_m: DEFAULT_PLAN_WIDTH_M };
  }
  const easts = vertices.map((v) => v.east_m);
  const norths = vertices.map((v) => v.north_m);
  return {
    length_m: clampLength(Math.max(...easts) - Math.min(...easts)),
    width_m: clampWidth(Math.max(...norths) - Math.min(...norths)),
  };
}

export function polygonToRectangle(sketch: PlanPolygonSketch): PlanRectangleSketch {
  const { length_m, width_m } = polygonBoundingBox(sketch.vertices);
  return createDefaultPlanSketch(length_m, width_m, 0);
}

export function createDefaultPolygonSketch(
  lengthM = DEFAULT_PLAN_LENGTH_M,
  widthM = DEFAULT_PLAN_WIDTH_M,
): PlanPolygonSketch {
  return rectangleToPolygon(createDefaultPlanSketch(lengthM, widthM, 0));
}

export function createEmptyPolygonSketch(): PlanPolygonSketch {
  return { kind: 'plan_polygon', vertices: [] };
}

export function clampVertex(vertex: PlanVertex): PlanVertex {
  return {
    east_m: Math.min(500, Math.max(-500, vertex.east_m)),
    north_m: Math.min(500, Math.max(-500, vertex.north_m)),
  };
}

export function snapVertex(vertex: PlanVertex, step: number): PlanVertex {
  if (step <= 0) return clampVertex(vertex);
  return clampVertex({
    east_m: snapMeters(vertex.east_m, step),
    north_m: snapMeters(vertex.north_m, step),
  });
}

export function movePolygonVertex(
  sketch: PlanPolygonSketch,
  index: number,
  eastM: number,
  northM: number,
  options?: { snapStep?: number },
): PlanPolygonSketch {
  const snap = options?.snapStep ?? 0;
  const vertices = sketch.vertices.map((v, i) => {
    if (i !== index) return v;
    return snapVertex({ east_m: eastM, north_m: northM }, snap);
  });
  return { ...sketch, vertices };
}

/** Move an edge segment by translating both endpoints from drag start positions. */
export function movePolygonEdgeFromDrag(
  sketch: PlanPolygonSketch,
  edgeIndex: number,
  pointerEast: number,
  pointerNorth: number,
  pointerStartEast: number,
  pointerStartNorth: number,
  edgeStartA: PlanVertex,
  edgeStartB: PlanVertex,
  options?: { snapStep?: number },
): PlanPolygonSketch {
  const deltaEast = pointerEast - pointerStartEast;
  const deltaNorth = pointerNorth - pointerStartNorth;
  const snap = options?.snapStep ?? 0;
  const nextIndex = (edgeIndex + 1) % sketch.vertices.length;
  const vertices = sketch.vertices.map((v, i) => {
    if (i === edgeIndex) {
      return snapVertex(
        { east_m: edgeStartA.east_m + deltaEast, north_m: edgeStartA.north_m + deltaNorth },
        snap,
      );
    }
    if (i === nextIndex) {
      return snapVertex(
        { east_m: edgeStartB.east_m + deltaEast, north_m: edgeStartB.north_m + deltaNorth },
        snap,
      );
    }
    return v;
  });
  return { ...sketch, vertices };
}

export type PlanAxisLock = 'east' | 'north';

export type PlanAxisConstraint = {
  lock: PlanAxisLock;
  anchorEast: number;
  anchorNorth: number;
};

/** Pick dominant axis for Alt-constrained drag (east = X, north = Y). */
export function pickPlanAxisLock(
  deltaEast: number,
  deltaNorth: number,
  currentLock: PlanAxisLock | null,
): PlanAxisLock | null {
  if (currentLock) return currentLock;
  const absE = Math.abs(deltaEast);
  const absN = Math.abs(deltaNorth);
  if (absE < 1e-9 && absN < 1e-9) return null;
  return absE >= absN ? 'east' : 'north';
}

export function applyPlanAxisLock(
  pointerEast: number,
  pointerNorth: number,
  anchorEast: number,
  anchorNorth: number,
  lock: PlanAxisLock,
): { east_m: number; north_m: number } {
  if (lock === 'east') {
    return { east_m: pointerEast, north_m: anchorNorth };
  }
  return { east_m: anchorEast, north_m: pointerNorth };
}

export function resolvePlanAxisDrag(
  pointerEast: number,
  pointerNorth: number,
  pointerStartEast: number,
  pointerStartNorth: number,
  axisLockEnabled: boolean,
  current: PlanAxisConstraint | null,
): { east_m: number; north_m: number; constraint: PlanAxisConstraint | null } {
  if (!axisLockEnabled) {
    return { east_m: pointerEast, north_m: pointerNorth, constraint: null };
  }

  let constraint = current;
  if (!constraint) {
    const lock = pickPlanAxisLock(
      pointerEast - pointerStartEast,
      pointerNorth - pointerStartNorth,
      null,
    );
    if (!lock) {
      return { east_m: pointerEast, north_m: pointerNorth, constraint: null };
    }
    constraint = { lock, anchorEast: pointerEast, anchorNorth: pointerNorth };
  }

  const point = applyPlanAxisLock(
    pointerEast,
    pointerNorth,
    constraint.anchorEast,
    constraint.anchorNorth,
    constraint.lock,
  );
  return { east_m: point.east_m, north_m: point.north_m, constraint };
}

export const RIGHT_ANGLE_GUIDE_TOLERANCE_DEG = 4;

export type RightAngleGuideLine = {
  east_m: number;
  north_m: number;
  east2_m: number;
  north2_m: number;
};

/** Interior angle at curr between segments to prev and next (degrees). */
export function vertexInteriorAngleDeg(
  prev: PlanVertex,
  curr: PlanVertex,
  next: PlanVertex,
): number | null {
  const v1e = prev.east_m - curr.east_m;
  const v1n = prev.north_m - curr.north_m;
  const v2e = next.east_m - curr.east_m;
  const v2n = next.north_m - curr.north_m;
  const l1 = Math.hypot(v1e, v1n);
  const l2 = Math.hypot(v2e, v2n);
  if (l1 < 1e-9 || l2 < 1e-9) return null;
  const dot = (v1e * v2e + v1n * v2n) / (l1 * l2);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

function extendLineThroughPoints(
  a: PlanVertex,
  b: PlanVertex,
  halfLength: number,
): RightAngleGuideLine {
  const dx = b.east_m - a.east_m;
  const dy = b.north_m - a.north_m;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    return { east_m: b.east_m, north_m: b.north_m, east2_m: b.east_m, north2_m: b.north_m };
  }
  const ux = dx / len;
  const uy = dy / len;
  return {
    east_m: b.east_m - ux * halfLength,
    north_m: b.north_m - uy * halfLength,
    east2_m: b.east_m + ux * halfLength,
    north2_m: b.north_m + uy * halfLength,
  };
}

/** Alignment lines when the dragged vertex forms ~90° with both adjacent edges. */
export function polygonVertexRightAngleGuides(
  vertices: PlanVertex[],
  vertexIndex: number,
  viewHalf: number,
  options?: { closed?: boolean; toleranceDeg?: number },
): RightAngleGuideLine[] {
  const n = vertices.length;
  if (n < 3 || vertexIndex < 0 || vertexIndex >= n) return [];
  const closed = options?.closed ?? n >= MIN_POLYGON_VERTICES;
  const tolerance = options?.toleranceDeg ?? RIGHT_ANGLE_GUIDE_TOLERANCE_DEG;

  let prevIdx: number | null = null;
  let nextIdx: number | null = null;
  if (closed) {
    prevIdx = (vertexIndex - 1 + n) % n;
    nextIdx = (vertexIndex + 1) % n;
  } else {
    if (vertexIndex > 0) prevIdx = vertexIndex - 1;
    if (vertexIndex < n - 1) nextIdx = vertexIndex + 1;
  }
  if (prevIdx == null || nextIdx == null) return [];

  const prev = vertices[prevIdx];
  const curr = vertices[vertexIndex];
  const next = vertices[nextIdx];
  const angle = vertexInteriorAngleDeg(prev, curr, next);
  if (angle == null || Math.abs(angle - 90) > tolerance) return [];

  const extent = Math.max(viewHalf * 1.15, 10);
  return [
    extendLineThroughPoints(prev, curr, extent),
    extendLineThroughPoints(curr, next, extent),
  ];
}

export function addPolygonVertex(
  sketch: PlanPolygonSketch,
  eastM: number,
  northM: number,
  options?: { snapStep?: number },
): PlanPolygonSketch {
  if (sketch.vertices.length >= MAX_POLYGON_VERTICES) return sketch;
  const vertex = snapVertex({ east_m: eastM, north_m: northM }, options?.snapStep ?? 0);
  return { ...sketch, vertices: [...sketch.vertices, vertex] };
}

export function removePolygonVertex(sketch: PlanPolygonSketch, index: number): PlanPolygonSketch {
  if (sketch.vertices.length <= MIN_POLYGON_VERTICES) return sketch;
  return { ...sketch, vertices: sketch.vertices.filter((_, i) => i !== index) };
}

export function insertPolygonVertexOnEdge(
  sketch: PlanPolygonSketch,
  edgeIndex: number,
  eastM: number,
  northM: number,
  options?: { snapStep?: number },
): PlanPolygonSketch {
  if (sketch.vertices.length >= MAX_POLYGON_VERTICES) return sketch;
  const vertex = snapVertex({ east_m: eastM, north_m: northM }, options?.snapStep ?? 0);
  const vertices = [...sketch.vertices];
  vertices.splice(edgeIndex + 1, 0, vertex);
  return { ...sketch, vertices };
}

/** Nearest edge index and projected point for insert tool. */
export function nearestPolygonEdge(
  sketch: PlanPolygonSketch,
  eastM: number,
  northM: number,
): { edgeIndex: number; east_m: number; north_m: number; distance: number } | null {
  const { vertices } = sketch;
  if (vertices.length < 2) return null;
  let best: { edgeIndex: number; east_m: number; north_m: number; distance: number } | null = null;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const projected = projectPointOnSegment(a, b, eastM, northM);
    if (!best || projected.distance < best.distance) {
      best = { edgeIndex: i, ...projected };
    }
  }
  return best;
}

function projectPointOnSegment(
  a: PlanVertex,
  b: PlanVertex,
  px: number,
  py: number,
): { east_m: number; north_m: number; distance: number } {
  const dx = b.east_m - a.east_m;
  const dy = b.north_m - a.north_m;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return {
      east_m: a.east_m,
      north_m: a.north_m,
      distance: Math.hypot(px - a.east_m, py - a.north_m),
    };
  }
  let t = ((px - a.east_m) * dx + (py - a.north_m) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const east_m = a.east_m + t * dx;
  const north_m = a.north_m + t * dy;
  return { east_m, north_m, distance: Math.hypot(px - east_m, py - north_m) };
}

export function polygonViewExtent(sketch: PlanPolygonSketch, fallback = 60): number {
  return polygonViewBboxHalfExtent(sketch, fallback) * 1.2;
}

/** Half-size of axis-aligned bbox around vertices (stable viewport basis). */
export function polygonViewBboxHalfExtent(sketch: PlanPolygonSketch, fallback = 60): number {
  if (sketch.vertices.length === 0) return fallback;
  const easts = sketch.vertices.map((v) => v.east_m);
  const norths = sketch.vertices.map((v) => v.north_m);
  const halfW = (Math.max(...easts) - Math.min(...easts)) / 2;
  const halfH = (Math.max(...norths) - Math.min(...norths)) / 2;
  return Math.max(fallback, halfW, halfH, 10);
}

/** View half-extent in meters; frozen value wins during drag so bbox growth does not zoom the canvas. */
export function computeStableViewHalfExtent(
  stableHalfExtent: number,
  frozenHalfExtent: number | null,
  zoom: number,
): number {
  const half = frozenHalfExtent ?? stableHalfExtent;
  return half / Math.max(zoom, 0.25);
}

export const VIEW_PAD_CONSTANT = 1.35;
export const EDGE_HIT_PX = 14;

export function metersPerScreenPixel(svg: SVGSVGElement): number {
  const ctm = svg.getScreenCTM();
  if (!ctm) return 1;
  return 1 / Math.hypot(ctm.a, ctm.b);
}

/** Nearest edge with distance threshold in screen pixels. */
export function nearestPolygonEdgePx(
  sketch: PlanPolygonSketch,
  eastM: number,
  northM: number,
  maxPx: number,
  metersPerPx: number,
): { edgeIndex: number; east_m: number; north_m: number; distance: number } | null {
  const nearest = nearestPolygonEdge(sketch, eastM, northM);
  if (!nearest) return null;
  const maxM = maxPx * metersPerPx;
  if (nearest.distance > maxM) return null;
  return nearest;
}

export function isPolygonSketchClosed(sketch: PlanPolygonSketch): boolean {
  return sketch.vertices.length >= MIN_POLYGON_VERTICES;
}
