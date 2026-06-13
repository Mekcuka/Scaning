/** Pan/zoom viewport helpers for pad earthwork plan sketch editors. */

export type PlanSketchPan = {
  east_m: number;
  north_m: number;
};

export const MIN_PLAN_SKETCH_ZOOM = 0.25;
export const MAX_PLAN_SKETCH_ZOOM = 8;
export const PLAN_SKETCH_WHEEL_ZOOM_FACTOR = 1.12;

export function clampPlanSketchZoom(zoom: number): number {
  return Math.min(MAX_PLAN_SKETCH_ZOOM, Math.max(MIN_PLAN_SKETCH_ZOOM, zoom));
}

export function buildPlanSketchViewBox(panEast: number, panNorth: number, viewHalf: number): string {
  const minX = panEast - viewHalf;
  const minY = -panNorth - viewHalf;
  const size = viewHalf * 2;
  return `${minX} ${minY} ${size} ${size}`;
}

/** Fit viewBox for read-only plan preview (north up, same as sketch editors). */
export function planSketchViewBoxForPoints(
  points: { east_m: number; north_m: number }[],
  padM = 14,
): string {
  if (points.length === 0) return buildPlanSketchViewBox(0, 0, 40);
  let minE = points[0]!.east_m;
  let maxE = minE;
  let minN = points[0]!.north_m;
  let maxN = minN;
  for (const p of points) {
    minE = Math.min(minE, p.east_m);
    maxE = Math.max(maxE, p.east_m);
    minN = Math.min(minN, p.north_m);
    maxN = Math.max(maxN, p.north_m);
  }
  const cx = (minE + maxE) / 2;
  const cy = (minN + maxN) / 2;
  const half = Math.max(maxE - minE, maxN - minN) / 2 + padM;
  return buildPlanSketchViewBox(cx, cy, Math.max(half, 24));
}

export function planSketchGridLines(
  panEast: number,
  panNorth: number,
  viewHalf: number,
  step: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
  if (step <= 0) return [];
  const minE = panEast - viewHalf;
  const maxE = panEast + viewHalf;
  const minN = panNorth - viewHalf;
  const maxN = panNorth + viewHalf;
  const startE = Math.floor(minE / step) * step;
  const startN = Math.floor(minN / step) * step;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let e = startE; e <= maxE + step * 0.001; e += step) {
    lines.push({ x1: e, y1: -maxN, x2: e, y2: -minN });
  }
  for (let n = startN; n <= maxN + step * 0.001; n += step) {
    lines.push({ x1: minE, y1: -n, x2: maxE, y2: -n });
  }
  return lines;
}

export function zoomPlanSketchAtWorldPoint(
  zoom: number,
  viewHalf: number,
  pan: PlanSketchPan,
  anchorEast: number,
  anchorNorth: number,
  zoomFactor: number,
): { zoom: number; pan: PlanSketchPan } {
  const nextZoom = clampPlanSketchZoom(zoom * zoomFactor);
  if (nextZoom === zoom) return { zoom, pan };
  const nextViewHalf = viewHalf * (zoom / nextZoom);
  const relEast = anchorEast - pan.east_m;
  const relNorth = anchorNorth - pan.north_m;
  const scale = nextViewHalf / viewHalf;
  return {
    zoom: nextZoom,
    pan: {
      east_m: anchorEast - relEast * scale,
      north_m: anchorNorth - relNorth * scale,
    },
  };
}

export function clientToPlanSketchLocal(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { east_m: number; north_m: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  return { east_m: local.x, north_m: -local.y };
}
