/** Local ENU projection for footprint perimeter picker (panel mini-map). */

import { EDGE_HIT_PX } from './padEarthworkSketch';
import { metersPerDegree } from './padFootprintGeo';
import { lonLatOnFootprintEdge, nearestFootprintEdge } from './padFootprintLineAttach';

export type LocalEnuPoint = { east_m: number; north_m: number };

export { EDGE_HIT_PX as FOOTPRINT_PICKER_EDGE_HIT_PX };

const LOCAL_EPS_M = 0.01;

export function localEnuPointsEqual(a: LocalEnuPoint, b: LocalEnuPoint): boolean {
  return Math.hypot(a.east_m - b.east_m, a.north_m - b.north_m) < LOCAL_EPS_M;
}

export function localRingEdgeCount(local: LocalEnuPoint[]): number {
  if (local.length < 2) return local.length;
  const first = local[0]!;
  const last = local[local.length - 1]!;
  if (localEnuPointsEqual(first, last)) return local.length - 1;
  return local.length;
}

export function closestPointOnLocalSegment(
  p: LocalEnuPoint,
  a: LocalEnuPoint,
  b: LocalEnuPoint,
): { t: number; east_m: number; north_m: number; distanceM: number } {
  const dx = b.east_m - a.east_m;
  const dy = b.north_m - a.north_m;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((p.east_m - a.east_m) * dx + (p.north_m - a.north_m) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const east_m = a.east_m + t * dx;
  const north_m = a.north_m + t * dy;
  const distanceM = Math.hypot(p.east_m - east_m, p.north_m - north_m);
  return { t, east_m, north_m, distanceM };
}

export type LocalRingPick = { edge_index: number; t: number; distanceM: number };

/** Nearest edge in flat ENU (matches SVG); optional max distance in meters. */
export function pickAttachOnLocalRing(
  local: LocalEnuPoint[],
  click: LocalEnuPoint,
  maxDistanceM?: number,
): { edge_index: number; t: number } | null {
  const hit = pickAttachOnLocalRingDetailed(local, click, maxDistanceM);
  if (!hit) return null;
  return { edge_index: hit.edge_index, t: hit.t };
}

export function pickAttachOnLocalRingDetailed(
  local: LocalEnuPoint[],
  click: LocalEnuPoint,
  maxDistanceM?: number,
): LocalRingPick | null {
  const n = localRingEdgeCount(local);
  if (n < 2) return null;
  let best: LocalRingPick | null = null;
  for (let i = 0; i < n; i += 1) {
    const hit = closestPointOnLocalSegment(click, local[i]!, local[(i + 1) % n]!);
    if (!best || hit.distanceM < best.distanceM) {
      best = { edge_index: i, t: hit.t, distanceM: hit.distanceM };
    }
  }
  if (!best) return null;
  if (maxDistanceM != null && best.distanceM > maxDistanceM) return null;
  return best;
}

export function ringVerticesForHitTest(local: LocalEnuPoint[]): LocalEnuPoint[] {
  if (local.length < 2) return local;
  if (localEnuPointsEqual(local[0]!, local[local.length - 1]!)) {
    return local.slice(0, -1);
  }
  return local;
}

export function pointInLocalRing(p: LocalEnuPoint, local: LocalEnuPoint[]): boolean {
  const ring = ringVerticesForHitTest(local);
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]!.east_m;
    const yi = ring[i]!.north_m;
    const xj = ring[j]!.east_m;
    const yj = ring[j]!.north_m;
    const intersect =
      yi > p.north_m !== yj > p.north_m &&
      p.east_m < ((xj - xi) * (p.north_m - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Outward offset from edge midpoint (CCW ring) in local ENU meters. */
export function outwardOffsetFromEdgeMid(
  local: LocalEnuPoint[],
  edgeIndex: number,
  t = 0.5,
  offsetM = 5,
): LocalEnuPoint | null {
  const n = localRingEdgeCount(local);
  if (edgeIndex < 0 || edgeIndex >= n) return null;
  const a = local[edgeIndex]!;
  const b = local[(edgeIndex + 1) % n]!;
  const midE = a.east_m + (b.east_m - a.east_m) * t;
  const midN = a.north_m + (b.north_m - a.north_m) * t;
  const dx = b.east_m - a.east_m;
  const dy = b.north_m - a.north_m;
  const len = Math.hypot(dx, dy);
  if (len < LOCAL_EPS_M) return null;
  return {
    east_m: midE + (-dy / len) * offsetM,
    north_m: midN + (dx / len) * offsetM,
  };
}

/** Picker hit-test: nearest edge; reject deep interior; generous padding picks. */
export function pickFootprintPerimeterAttach(
  local: LocalEnuPoint[],
  click: LocalEnuPoint,
  viewBoxWidthM: number,
): { edge_index: number; t: number } | null {
  const hit = pickAttachOnLocalRingDetailed(local, click);
  if (!hit) return null;
  const inside = pointInLocalRing(click, local);
  const maxDist = inside ? viewBoxWidthM * 0.08 : viewBoxWidthM * 0.5;
  if (hit.distanceM > maxDist) return null;
  return { edge_index: hit.edge_index, t: hit.t };
}

export function metersPerScreenPixelFromSvg(svg: SVGSVGElement): number {
  const ctm = svg.getScreenCTM();
  if (!ctm) return 1;
  return 1 / Math.hypot(ctm.a, ctm.b);
}

export function ringLonLatToLocalEnu(
  ring: [number, number][],
  anchorLon: number,
  anchorLat: number,
): LocalEnuPoint[] {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(anchorLat);
  const pts = ring.map(([lo, la]) => ({
    east_m: (lo - anchorLon) * mPerDegLon,
    north_m: (la - anchorLat) * mPerDegLat,
  }));
  if (pts.length >= 2 && localEnuPointsEqual(pts[0]!, pts[pts.length - 1]!)) {
    return pts.slice(0, -1);
  }
  return pts;
}

export function localEnuToLonLat(
  east_m: number,
  north_m: number,
  anchorLon: number,
  anchorLat: number,
): [number, number] {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(anchorLat);
  return [anchorLon + east_m / mPerDegLon, anchorLat + north_m / mPerDegLat];
}

export function computeFootprintPickerViewBox(
  local: LocalEnuPoint[],
  paddingM = 8,
): { minX: number; minY: number; width: number; height: number } {
  if (local.length === 0) {
    return { minX: -50, minY: -50, width: 100, height: 100 };
  }
  let minE = local[0]!.east_m;
  let maxE = local[0]!.east_m;
  let minN = local[0]!.north_m;
  let maxN = local[0]!.north_m;
  for (const p of local) {
    minE = Math.min(minE, p.east_m);
    maxE = Math.max(maxE, p.east_m);
    minN = Math.min(minN, p.north_m);
    maxN = Math.max(maxN, p.north_m);
  }
  const contentW = maxE - minE;
  const contentH = maxN - minN;
  const pad = Math.max(paddingM, (contentW + contentH) * 0.08);
  const side = Math.max(contentW, contentH, 40) + pad * 2;
  const centerE = (minE + maxE) / 2;
  const centerN = (minN + maxN) / 2;
  return {
    minX: centerE - side / 2,
    minY: -(centerN + side / 2),
    width: side,
    height: side,
  };
}

/** SVG y-up: local north → negative y. */
export function localEnuToSvg(local: LocalEnuPoint): { x: number; y: number } {
  return { x: local.east_m, y: -local.north_m };
}

export function svgToLocalEnu(x: number, y: number): LocalEnuPoint {
  return { east_m: x, north_m: -y };
}

export function clientToLocalEnuFromSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): LocalEnuPoint | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  return svgToLocalEnu(local.x, local.y);
}

export function pickAttachOnRing(
  ring: [number, number][],
  clickLonLat: [number, number],
): { edge_index: number; t: number } | null {
  const hit = nearestFootprintEdge(ring, clickLonLat);
  if (!hit) return null;
  return { edge_index: hit.edgeIndex, t: hit.t };
}

export function attachMarkerLocal(
  ring: [number, number][],
  anchorLon: number,
  anchorLat: number,
  edgeIndex: number,
  t = 0.5,
): LocalEnuPoint | null {
  const lonLat = lonLatOnFootprintEdge(ring, edgeIndex, t);
  if (!lonLat) return null;
  const [lo, la] = lonLat;
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(anchorLat);
  return {
    east_m: (lo - anchorLon) * mPerDegLon,
    north_m: (la - anchorLat) * mPerDegLat,
  };
}

export function polygonPathFromLocal(local: LocalEnuPoint[], closed = true): string {
  if (local.length === 0) return '';
  const dupClosed =
    local.length >= 2 &&
    localEnuPointsEqual(local[0]!, local[local.length - 1]!);
  const pts = closed && dupClosed ? local.slice(0, -1) : local;
  return pts
    .map((p, i) => {
      const { x, y } = localEnuToSvg(p);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ')
    .concat(' Z');
}

export function edgeSegmentLocal(
  local: LocalEnuPoint[],
  edgeIndex: number,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (local.length < 2 || edgeIndex < 0) return null;
  const n = localRingEdgeCount(local);
  if (edgeIndex >= n) return null;
  const a = localEnuToSvg(local[edgeIndex]!);
  const b = localEnuToSvg(local[(edgeIndex + 1) % n]!);
  return [a, b];
}
