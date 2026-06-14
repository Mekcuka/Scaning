import { clampVertex, polygonPerimeterM } from './polygon';
import { localPlanCorners } from './rectangle';
import { isPlanPolygon, type PlanShapeSketch, type PlanVertex } from './types';

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
