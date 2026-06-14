import {
  clampLength,
  clampRotation,
  clampWidth,
  MIN_DIM,
  parsePositive,
  parseRotation,
} from './clamp';
import {
  DEFAULT_PLAN_LENGTH_M,
  DEFAULT_PLAN_WIDTH_M,
  snapMeters,
  type PlanPolygonSketch,
  type PlanRectangleSketch,
} from './types';

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

export function rectangleToPolygon(sketch: PlanRectangleSketch): PlanPolygonSketch {
  const corners = localPlanCorners(sketch);
  return {
    kind: 'plan_polygon',
    vertices: corners.map((c) => ({ east_m: c.east_m, north_m: c.north_m })),
  };
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
