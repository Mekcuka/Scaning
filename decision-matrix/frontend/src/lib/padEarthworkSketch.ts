/** Pad earthwork plan sketch types and helpers. */

import { DEFAULT_PAD_NDS_DEG, ndsDegToMathRotationDeg } from './infraPadEarthwork';

export type PlanVertex = {
  east_m: number;
  north_m: number;
};

export type PlanRectangleSketch = {
  kind: 'plan_rectangle';
  length_m: number;
  width_m: number;
  rotation_deg: number;
};

export type PlanPolygonSketch = {
  kind: 'plan_polygon';
  vertices: PlanVertex[];
};

export type PlanShapeSketch = PlanRectangleSketch | PlanPolygonSketch;

export type ShapeMode = 'rectangle' | 'polygon' | 'generator';

export type ProfileSketch = {
  kind: 'profile';
  width_m: number;
  chainage_points: { chainage_m: number; elevation_m: number }[];
  design_elevation_m: number;
};

export type PadEarthworkSketch = PlanRectangleSketch | PlanPolygonSketch | ProfileSketch;

export type SketchPreview = {
  length_m: number;
  width_m: number;
  rotation_deg: number;
  footprint_area_m2: number;
  footprint_corners_local: { east_m: number; north_m: number }[];
};

export const DEFAULT_PLAN_LENGTH_M = 120;
export const DEFAULT_PLAN_WIDTH_M = 80;
export const SNAP_STEP_M = 1;

export const PAD_SIZE_PRESETS: { label: string; length_m: number; width_m: number }[] = [
  { label: '80×60', length_m: 80, width_m: 60 },
  { label: '120×80', length_m: 120, width_m: 80 },
  { label: '150×100', length_m: 150, width_m: 100 },
  { label: '200×120', length_m: 200, width_m: 120 },
];

export type PlanEditTool = 'corners' | 'edges' | 'rotate';
export type PolygonEditTool = 'draw' | 'vertices' | 'insert' | 'erase';

export const MAX_POLYGON_VERTICES = 64;
export const MIN_POLYGON_VERTICES = 3;

export function snapMeters(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
}

export function isPlanPolygon(sketch: PlanShapeSketch): sketch is PlanPolygonSketch {
  return sketch.kind === 'plan_polygon';
}

export function isPlanRectangle(sketch: PlanShapeSketch): sketch is PlanRectangleSketch {
  return sketch.kind === 'plan_rectangle';
}

export function estimateFillM3(sketch: PlanShapeSketch, heightM: number): number | null {
  if (!Number.isFinite(heightM) || heightM <= 0) return null;
  return sketchFootprintAreaM2(sketch) * heightM;
}

export function sketchFootprintAreaM2(sketch: PlanShapeSketch): number {
  return isPlanPolygon(sketch) ? polygonFootprintAreaM2(sketch) : planFootprintAreaM2(sketch);
}

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

export function rectangleToPolygon(sketch: PlanRectangleSketch): PlanPolygonSketch {
  const corners = localPlanCorners(sketch);
  return {
    kind: 'plan_polygon',
    vertices: corners.map((c) => ({ east_m: c.east_m, north_m: c.north_m })),
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

export function createDefaultPlanSketch(
  lengthM = DEFAULT_PLAN_LENGTH_M,
  widthM = DEFAULT_PLAN_WIDTH_M,
  rotationDeg = 0,
): PlanRectangleSketch {
  return {
    kind: 'plan_rectangle',
    length_m: clampLength(lengthM),
    width_m: clampWidth(widthM),
    rotation_deg: clampRotation(rotationDeg),
  };
}

export function planFromFormFields(
  lengthM: string,
  widthM: string,
  rotationDeg: string,
): PlanRectangleSketch | null {
  const length = parsePositive(lengthM);
  const width = parsePositive(widthM);
  if (length == null || width == null) return null;
  const rot = parseRotation(rotationDeg);
  return createDefaultPlanSketch(length, width, rot);
}

export function planFootprintAreaM2(sketch: PlanRectangleSketch): number {
  return sketch.length_m * sketch.width_m;
}

export function localPlanCorners(sketch: PlanRectangleSketch): { east_m: number; north_m: number }[] {
  const hl = sketch.length_m / 2;
  const hw = sketch.width_m / 2;
  const local = [
    { east_m: -hl, north_m: -hw },
    { east_m: hl, north_m: -hw },
    { east_m: hl, north_m: hw },
    { east_m: -hl, north_m: hw },
  ];
  const rad = (sketch.rotation_deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return local.map(({ east_m, north_m }) => ({
    east_m: east_m * cos - north_m * sin,
    north_m: east_m * sin + north_m * cos,
  }));
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

export function shapeModeFromSketch(
  sketch: PlanShapeSketch | null | undefined,
  wellsLocal?: PlanVertex[],
): ShapeMode {
  if (wellsLocal?.length) return 'generator';
  if (sketch && isPlanPolygon(sketch)) return 'polygon';
  return 'rectangle';
}

const MAX_LENGTH = 500;
const MAX_WIDTH = 500;
const MIN_DIM = 1;

function clampLength(n: number): number {
  return Math.min(MAX_LENGTH, Math.max(MIN_DIM, n));
}

function clampWidth(n: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_DIM, n));
}

function clampRotation(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(180, Math.max(-180, n));
}

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRotation(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return clampRotation(n);
}

function toLocalFrame(
  sketch: PlanRectangleSketch,
  eastM: number,
  northM: number,
): { localEast: number; localNorth: number } {
  const rad = (-sketch.rotation_deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    localEast: eastM * cos - northM * sin,
    localNorth: eastM * sin + northM * cos,
  };
}

function applySnapDims(
  length: number,
  width: number,
  snapStep: number,
  lockAspect: boolean,
  aspectRatio: number,
): { length_m: number; width_m: number } {
  const l = clampLength(snapStep > 0 ? snapMeters(length, snapStep) : length);
  let w = clampWidth(snapStep > 0 ? snapMeters(width, snapStep) : width);
  if (lockAspect && aspectRatio > 0) {
    w = clampWidth(l / aspectRatio);
  }
  return { length_m: l, width_m: w };
}

/** Update length/width from dragged corner in local ENU (east, north). */
export function sketchFromCornerDrag(
  sketch: PlanRectangleSketch,
  _cornerIndex: number,
  eastM: number,
  northM: number,
  options?: { snapStep?: number; lockAspect?: boolean },
): PlanRectangleSketch {
  const { localEast, localNorth } = toLocalFrame(sketch, eastM, northM);
  const hl = Math.max(MIN_DIM / 2, Math.abs(localEast));
  const hw = Math.max(MIN_DIM / 2, Math.abs(localNorth));
  const aspect = sketch.length_m / sketch.width_m;
  const dims = applySnapDims(
    hl * 2,
    hw * 2,
    options?.snapStep ?? 0,
    options?.lockAspect ?? false,
    aspect,
  );
  return { ...sketch, ...dims };
}

/** Edge index 0=bottom, 1=right, 2=top, 3=left (local frame before rotation). */
export function sketchFromEdgeDrag(
  sketch: PlanRectangleSketch,
  edgeIndex: number,
  eastM: number,
  northM: number,
  options?: { snapStep?: number },
): PlanRectangleSketch {
  const { localEast, localNorth } = toLocalFrame(sketch, eastM, northM);
  const snap = options?.snapStep ?? 0;
  if (edgeIndex === 0 || edgeIndex === 2) {
    const hw = Math.max(MIN_DIM / 2, Math.abs(localNorth));
    let w = clampWidth(hw * 2);
    if (snap > 0) w = clampWidth(snapMeters(w, snap));
    return { ...sketch, width_m: w };
  }
  const hl = Math.max(MIN_DIM / 2, Math.abs(localEast));
  let l = clampLength(hl * 2);
  if (snap > 0) l = clampLength(snapMeters(l, snap));
  return { ...sketch, length_m: l };
}

export function sketchFromRotationDrag(
  sketch: PlanRectangleSketch,
  eastM: number,
  northM: number,
  options?: { snapStep?: number },
): PlanRectangleSketch {
  const deg = (Math.atan2(northM, eastM) * 180) / Math.PI - 90;
  let rotation = clampRotation(deg);
  const snap = options?.snapStep ?? 0;
  if (snap > 0) rotation = clampRotation(snapMeters(rotation, snap));
  return { ...sketch, rotation_deg: rotation };
}

export function localPlanEdgeMidpoints(
  sketch: PlanRectangleSketch,
): { east_m: number; north_m: number }[] {
  const corners = localPlanCorners(sketch);
  return corners.map((c, i) => {
    const next = corners[(i + 1) % 4];
    return {
      east_m: (c.east_m + next.east_m) / 2,
      north_m: (c.north_m + next.north_m) / 2,
    };
  });
}

export function rotationHandlePosition(sketch: PlanRectangleSketch): { east_m: number; north_m: number } {
  const corners = localPlanCorners(sketch);
  const topMid = {
    east_m: (corners[2].east_m + corners[3].east_m) / 2,
    north_m: (corners[2].north_m + corners[3].north_m) / 2,
  };
  const len = Math.hypot(topMid.east_m, topMid.north_m) || 1;
  const offset = Math.max(sketch.length_m, sketch.width_m) * 0.12;
  return {
    east_m: topMid.east_m + (topMid.east_m / len) * offset,
    north_m: topMid.north_m + (topMid.north_m / len) * offset,
  };
}

export function adjustSketchDimension(
  sketch: PlanRectangleSketch,
  field: 'length_m' | 'width_m' | 'rotation_deg',
  delta: number,
  options?: { snapStep?: number; lockAspect?: boolean },
): PlanRectangleSketch {
  const aspect = sketch.length_m / sketch.width_m;
  let length = sketch.length_m;
  let width = sketch.width_m;
  let rotation = sketch.rotation_deg;
  if (field === 'length_m') length = clampLength(length + delta);
  if (field === 'width_m') width = clampWidth(width + delta);
  if (field === 'rotation_deg') rotation = clampRotation(rotation + delta);
  const snap = options?.snapStep ?? 0;
  const dims = applySnapDims(length, width, snap, options?.lockAspect ?? false, aspect);
  return {
    ...sketch,
    ...dims,
    rotation_deg: field === 'rotation_deg' && snap > 0 ? snapMeters(rotation, snap) : rotation,
  };
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

export type EnvelopeWrapParams = {
  enabled: boolean;
  wrap_width_m: number;
};

export const DEFAULT_ENVELOPE_WRAP_WIDTH_M = 3;

function edgeOutwardNormal(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: dy / len, y: -dx / len };
}

/** Outward offset polygon (CCW vertices). Miter with bevel clamp on sharp angles. Negative distance = inward. */
export function offsetPolygonOutward(vertices: PlanVertex[], distance: number): PlanVertex[] {
  const n = vertices.length;
  if (n < 3 || distance === 0) return vertices.map((v) => ({ ...v }));
  const dist = Math.abs(distance);
  const sign = distance < 0 ? -1 : 1;
  const maxMiter = dist * 4;
  const out: PlanVertex[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const e1x = curr.east_m - prev.east_m;
    const e1y = curr.north_m - prev.north_m;
    const e2x = next.east_m - curr.east_m;
    const e2y = next.north_m - curr.north_m;
    const n1 = edgeOutwardNormal(e1x, e1y);
    const n2 = edgeOutwardNormal(e2x, e2y);
    let bx = n1.x + n2.x;
    let by = n1.y + n2.y;
    const bl = Math.hypot(bx, by);
    let ox: number;
    let oy: number;
    if (bl < 1e-9) {
      ox = n1.x * dist;
      oy = n1.y * dist;
    } else {
      bx /= bl;
      by /= bl;
      const dot = n1.x * bx + n1.y * by;
      const scale = Math.abs(dot) > 1e-6 ? dist / dot : dist;
      if (!Number.isFinite(scale) || scale < 0 || scale > maxMiter) {
        ox = n1.x * dist;
        oy = n1.y * dist;
      } else {
        ox = bx * scale;
        oy = by * scale;
      }
    }
    out.push(
      clampVertex({ east_m: curr.east_m + sign * ox, north_m: curr.north_m + sign * oy }),
    );
  }
  return out;
}

export function offsetPolygonInward(vertices: PlanVertex[], distance: number): PlanVertex[] {
  return offsetPolygonOutward(vertices, -distance);
}

export function envelopeFillVolumeM3(areaTop: number, areaBottom: number, heightM: number): number {
  if (heightM <= 0) return 0;
  return (heightM / 3) * (areaTop + areaBottom + Math.sqrt(Math.max(0, areaTop * areaBottom)));
}

export function estimateEnvelopeFillM3(
  sketch: PlanShapeSketch,
  heightM: number,
  wrapWidthM: number,
): number | null {
  if (!Number.isFinite(heightM) || heightM <= 0 || wrapWidthM <= 0) return null;
  const vol = estimateEnvelopeBermRingVolumeM3(sketch, wrapWidthM);
  return vol > 0 ? vol : null;
}

/** Crest cap width TW between outer and inner crest (symmetric isosceles trapezoid). */
export function envelopeBermCrestCapWidthM(wrapWidthM: number): number {
  return wrapWidthM / 3;
}

/** 1:1 slope rise H = (W − TW) / 2 for both berm faces. */
export function envelopeBermSlopeHeightM(wrapWidthM: number): number {
  if (wrapWidthM <= 0) return 0;
  const tw = envelopeBermCrestCapWidthM(wrapWidthM);
  return (wrapWidthM - tw) / 2;
}

/** Trapezoid cross-section area of berm strip (per meter of edge). */
export function envelopeBermCrossSectionAreaM2(wrapWidthM: number): number {
  const h = envelopeBermSlopeHeightM(wrapWidthM);
  const tw = envelopeBermCrestCapWidthM(wrapWidthM);
  if (h <= 0 || wrapWidthM <= 0) return 0;
  return (h * (wrapWidthM + tw)) / 2;
}

/** Berm ring volume: perimeter × trapezoid cross-section (variant A). */
export function estimateEnvelopeBermRingVolumeM3(
  sketch: PlanShapeSketch,
  wrapWidthM: number,
): number {
  const verts = shapeVerticesForEnvelope(sketch);
  if (verts.length < 3 || wrapWidthM <= 0) return 0;
  return polygonPerimeterM(verts) * envelopeBermCrossSectionAreaM2(wrapWidthM);
}

export function planVerticesCentroid(vertices: PlanVertex[]): PlanVertex {
  if (vertices.length === 0) return { east_m: 0, north_m: 0 };
  return {
    east_m: vertices.reduce((sum, v) => sum + v.east_m, 0) / vertices.length,
    north_m: vertices.reduce((sum, v) => sum + v.north_m, 0) / vertices.length,
  };
}

export function envelopeOuterVertices(sketch: PlanShapeSketch, wrapWidthM: number): PlanVertex[] {
  const topVerts = shapeVerticesForEnvelope(sketch);
  if (topVerts.length < 3 || wrapWidthM <= 0) return topVerts;
  return offsetPolygonOutward(topVerts, wrapWidthM);
}

/** Outer edge of berm sole — coincides with pad top footprint. */
export function envelopeBermSoleOuterVertices(sketch: PlanShapeSketch): PlanVertex[] {
  return shapeVerticesForEnvelope(sketch);
}

/** Inner edge of berm sole — inset W from pad edge on pad top. */
export function envelopeBermSoleInnerVertices(
  sketch: PlanShapeSketch,
  wrapWidthM: number,
): PlanVertex[] {
  const outer = envelopeBermSoleOuterVertices(sketch);
  if (outer.length < 3 || wrapWidthM <= 0) return outer;
  return offsetPolygonInward(outer, wrapWidthM);
}

/** Outer crest line at inset H = (W − TW) / 2 from pad edge (1:1 from boundary). */
export function envelopeBermCrestOuterVertices(
  sketch: PlanShapeSketch,
  wrapWidthM: number,
): PlanVertex[] {
  const outer = envelopeBermSoleOuterVertices(sketch);
  if (outer.length < 3 || wrapWidthM <= 0) return outer;
  return offsetPolygonInward(outer, envelopeBermSlopeHeightM(wrapWidthM));
}

/** Inner crest line at inset (W + TW) / 2 — symmetric 1:1 from sole inner edge. */
export function envelopeBermCrestInnerVertices(
  sketch: PlanShapeSketch,
  wrapWidthM: number,
): PlanVertex[] {
  const outer = envelopeBermSoleOuterVertices(sketch);
  if (outer.length < 3 || wrapWidthM <= 0) return outer;
  const tw = envelopeBermCrestCapWidthM(wrapWidthM);
  return offsetPolygonInward(outer, (wrapWidthM + tw) / 2);
}

export function shapeVerticesForEnvelope(sketch: PlanShapeSketch): PlanVertex[] {
  if (isPlanPolygon(sketch)) return sketch.vertices;
  return localPlanCorners(sketch).map((c) => ({ east_m: c.east_m, north_m: c.north_m }));
}

export function isPolygonSketchClosed(sketch: PlanPolygonSketch): boolean {
  return sketch.vertices.length >= MIN_POLYGON_VERTICES;
}

export type PadLayoutMarginsInput = {
  leftM: number;
  bottomM: number;
  topM: number;
  endM: number;
};

export type PadWellLayoutInput = {
  wellCount: number;
  wellsPerGroup: number;
  wellSpacingM: number;
  groupSpacingM: number;
  margins: PadLayoutMarginsInput;
  rotationDeg?: number;
};

export type PadWellLayoutResult = {
  sketch: PlanPolygonSketch;
  wellsLocal: PlanVertex[];
  lengthM: number;
  widthM: number;
  rotationDeg: number;
  footprintAreaM2: number;
};

export class PadWellLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PadWellLayoutError';
  }
}

export function computeWellPositionsEastM(
  wellCount: number,
  wellsPerGroup: number,
  wellSpacingM: number,
  groupSpacingM: number,
): number[] {
  if (wellCount < 1) throw new PadWellLayoutError('well_count must be at least 1');
  const positions = [0];
  for (let i = 1; i < wellCount; i += 1) {
    if (i % wellsPerGroup !== 0) {
      positions.push(positions[i - 1]! + wellSpacingM);
    } else {
      positions.push(positions[i - 1]! + groupSpacingM);
    }
  }
  return positions;
}

function rotatePlanPoint(eastM: number, northM: number, rotationDeg: number): PlanVertex {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    east_m: eastM * cos - northM * sin,
    north_m: eastM * sin + northM * cos,
  };
}

export function parseProfileFromLast(raw: unknown): ProfileSketch | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'profile') return null;
  const width = Number(o.width_m);
  const design = Number(o.design_elevation_m);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(design)) return null;
  const rawPoints = o.chainage_points;
  const chainage_points: { chainage_m: number; elevation_m: number }[] = [];
  if (Array.isArray(rawPoints)) {
    for (const item of rawPoints) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      const chainage = Number(p.chainage_m);
      const elevation = Number(p.elevation_m);
      if (!Number.isFinite(chainage) || !Number.isFinite(elevation)) continue;
      chainage_points.push({ chainage_m: chainage, elevation_m: elevation });
    }
  }
  return {
    kind: 'profile',
    width_m: Math.min(500, Math.max(1, width)),
    design_elevation_m: design,
    chainage_points: sortChainagePoints(chainage_points),
  };
}

export function defaultProfileSketch(
  lengthM: number,
  widthM: number,
  referenceElevationM: number,
  heightM: number,
): ProfileSketch {
  const length = Math.max(1, lengthM);
  const design = referenceElevationM + heightM;
  return {
    kind: 'profile',
    width_m: Math.min(500, Math.max(1, widthM)),
    design_elevation_m: design,
    chainage_points: [
      { chainage_m: 0, elevation_m: referenceElevationM },
      { chainage_m: length, elevation_m: referenceElevationM },
    ],
  };
}

export function sortChainagePoints(
  points: { chainage_m: number; elevation_m: number }[],
): { chainage_m: number; elevation_m: number }[] {
  return [...points].sort((a, b) => a.chainage_m - b.chainage_m);
}

export function profileLengthM(points: { chainage_m: number; elevation_m: number }[]): number {
  if (points.length === 0) return 0;
  const chainages = points.map((p) => p.chainage_m);
  return Math.max(...chainages) - Math.min(...chainages);
}

export function profileToApiPayload(sketch: ProfileSketch): ProfileSketch {
  return {
    kind: 'profile',
    width_m: Math.min(500, Math.max(1, sketch.width_m)),
    design_elevation_m: sketch.design_elevation_m,
    chainage_points: sortChainagePoints(sketch.chainage_points).map((p) => ({
      chainage_m: Math.round(p.chainage_m * 1000) / 1000,
      elevation_m: Math.round(p.elevation_m * 1000) / 1000,
    })),
  };
}

export function estimateProfileVolumes(sketch: ProfileSketch): {
  fill_m3: number;
  cut_m3: number;
} {
  const points = sortChainagePoints(sketch.chainage_points);
  if (points.length < 2) return { fill_m3: 0, cut_m3: 0 };
  const design = sketch.design_elevation_m;
  const width = sketch.width_m;
  let fill = 0;
  let cut = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const s0 = points[i].chainage_m;
    const z0 = points[i].elevation_m;
    const s1 = points[i + 1].chainage_m;
    const z1 = points[i + 1].elevation_m;
    const ds = s1 - s0;
    if (ds <= 0) continue;
    const dz0 = design - z0;
    const dz1 = design - z1;
    fill += (width * ds * (Math.max(dz0, 0) + Math.max(dz1, 0))) / 2;
    cut += (width * ds * (Math.max(-dz0, 0) + Math.max(-dz1, 0))) / 2;
  }
  return { fill_m3: fill, cut_m3: cut };
}

export function generatePadFromWells(input: PadWellLayoutInput): PadWellLayoutResult {
  const ndsDeg = input.rotationDeg ?? DEFAULT_PAD_NDS_DEG;
  const rotationDeg = ndsDegToMathRotationDeg(ndsDeg);
  const positions = computeWellPositionsEastM(
    input.wellCount,
    input.wellsPerGroup,
    input.wellSpacingM,
    input.groupSpacingM,
  );
  const lastEast = positions[positions.length - 1]!;
  const { leftM, bottomM, topM, endM } = input.margins;
  const lengthM = leftM + lastEast + endM;
  const widthM = bottomM + topM;
  if (lengthM <= 0 || widthM <= 0 || lengthM > MAX_LENGTH || widthM > MAX_WIDTH) {
    throw new PadWellLayoutError('pad dimensions exceed limits');
  }

  const rawCorners: PlanVertex[] = [
    { east_m: -leftM, north_m: -bottomM },
    { east_m: lastEast + endM, north_m: -bottomM },
    { east_m: lastEast + endM, north_m: topM },
    { east_m: -leftM, north_m: topM },
  ];
  const vertices = rawCorners.map((v) => rotatePlanPoint(v.east_m, v.north_m, rotationDeg));
  const wellsLocal = positions.map((east) => rotatePlanPoint(east, 0, rotationDeg));
  const sketch: PlanPolygonSketch = { kind: 'plan_polygon', vertices };
  return {
    sketch,
    wellsLocal,
    lengthM,
    widthM,
    rotationDeg: ndsDeg,
    footprintAreaM2: polygonFootprintAreaM2(sketch),
  };
}
