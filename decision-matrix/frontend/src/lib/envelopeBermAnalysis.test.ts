/**
 * Variant A: symmetric isosceles trapezoid berm (both slopes 1:1, H = (W − TW) / 2).
 */
import { describe, expect, it } from 'vitest';
import {
  envelopeBermCrestCapWidthM,
  envelopeBermCrestInnerVertices,
  envelopeBermCrestOuterVertices,
  envelopeBermSoleInnerVertices,
  envelopeBermSoleOuterVertices,
  envelopeBermSlopeHeightM,
  type PlanRectangleSketch,
} from './padEarthworkSketch';

const W = 3;

const axisRect: PlanRectangleSketch = {
  kind: 'plan_rectangle',
  length_m: 120,
  width_m: 80,
  rotation_deg: 0,
};

function edgeInwardNormal(v0: { east_m: number; north_m: number }, v1: typeof v0) {
  const dx = v1.east_m - v0.east_m;
  const dy = v1.north_m - v0.north_m;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function projectOnNormal(
  p: { east_m: number; north_m: number },
  origin: typeof p,
  n: { x: number; y: number },
) {
  const dx = p.east_m - origin.east_m;
  const dy = p.north_m - origin.north_m;
  return dx * n.x + dy * n.y;
}

function bermCrossSectionAtEdge(
  footprint: { east_m: number; north_m: number }[],
  inner: typeof footprint,
  outerCrest: typeof footprint,
  innerCrest: typeof footprint,
  edgeIndex: number,
) {
  const i = edgeIndex;
  const j = (i + 1) % footprint.length;
  const out0 = footprint[i]!;
  const in0 = inner[i]!;
  const oc0 = outerCrest[i]!;
  const ic0 = innerCrest[i]!;
  const n = edgeInwardNormal(out0, footprint[j]!);
  const uOut = 0;
  const uIn = projectOnNormal(in0, out0, n);
  const uOc = projectOnNormal(oc0, out0, n);
  const uIc = projectOnNormal(ic0, out0, n);
  const bottomWidth = uIn - uOut;
  const topWidth = uIc - uOc;
  const outerRun = uOc - uOut;
  const innerRun = uIn - uIc;
  const H = envelopeBermSlopeHeightM(W);
  const outerSlopeRatio = outerRun / H;
  const innerSlopeRatio = innerRun / H;
  const isIsoscelesTrapezoid =
    topWidth < bottomWidth - 0.05 &&
    Math.abs(outerRun - innerRun) < 0.05 &&
    Math.abs(outerRun - H) < 0.05 &&
    Math.abs(topWidth - envelopeBermCrestCapWidthM(W)) < 0.05;
  return {
    bottomWidth,
    topWidth,
    outerRun,
    innerRun,
    outerSlopeRatio,
    innerSlopeRatio,
    isIsoscelesTrapezoid,
  };
}

describe('envelope berm variant A (isosceles trapezoid)', () => {
  const footprint = envelopeBermSoleOuterVertices(axisRect);
  const inner = envelopeBermSoleInnerVertices(axisRect, W);
  const outerCrest = envelopeBermCrestOuterVertices(axisRect, W);
  const innerCrest = envelopeBermCrestInnerVertices(axisRect, W);
  const H = envelopeBermSlopeHeightM(W);
  const TW = envelopeBermCrestCapWidthM(W);

  it('uses H = (W − TW) / 2', () => {
    expect(TW).toBe(1);
    expect(H).toBe(1);
    expect(H).toBe((W - TW) / 2);
  });

  it('cross-section at long edge is symmetric isosceles trapezoid with 1:1 slopes', () => {
    const cs = bermCrossSectionAtEdge(footprint, inner, outerCrest, innerCrest, 0);
    expect(cs.bottomWidth).toBeCloseTo(W, 2);
    expect(cs.topWidth).toBeCloseTo(TW, 2);
    expect(cs.outerRun).toBeCloseTo(H, 2);
    expect(cs.innerRun).toBeCloseTo(H, 2);
    expect(cs.outerSlopeRatio).toBeCloseTo(1, 2);
    expect(cs.innerSlopeRatio).toBeCloseTo(1, 2);
    expect(cs.isIsoscelesTrapezoid).toBe(true);
  });

  it('outer crest is inset H, inner crest at (W + TW) / 2', () => {
    const cs = bermCrossSectionAtEdge(footprint, inner, outerCrest, innerCrest, 0);
    expect(cs.outerRun).toBeCloseTo((W - TW) / 2, 2);
    expect(cs.outerRun + cs.topWidth).toBeCloseTo((W + TW) / 2, 2);
  });
});
