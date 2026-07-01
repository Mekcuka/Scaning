import { describe, expect, it } from 'vitest';
import {
  envelopeBermCrestCapWidthM,
  envelopeBermCrestInnerVertices,
  envelopeBermCrestOuterVertices,
  envelopeBermSoleInnerVertices,
  envelopeBermSlopeHeightM,
  type PlanRectangleSketch,
} from '../padEarthworkSketch';

const rectangleSketch: PlanRectangleSketch = {
  kind: 'plan_rectangle',
  length_m: 120,
  width_m: 80,
  rotation_deg: 15,
};

const axisRect: PlanRectangleSketch = {
  kind: 'plan_rectangle',
  length_m: 120,
  width_m: 80,
  rotation_deg: 0,
};

function edgeLen(a: { east_m: number; north_m: number }, b: { east_m: number; north_m: number }) {
  return Math.hypot(b.east_m - a.east_m, b.north_m - a.north_m);
}

describe('envelope berm variant A geometry', () => {
  const W = 3;
  const H = envelopeBermSlopeHeightM(W);
  const TW = envelopeBermCrestCapWidthM(W);

  it('crest cap TW and slope height H follow variant A', () => {
    expect(TW).toBe(1);
    expect(H).toBe(1);
    expect(H).toBe((W - TW) / 2);
  });

  it('outer crest ring is inset less than sole inner (closer to pad edge)', () => {
    const inner = envelopeBermSoleInnerVertices(axisRect, W);
    const outerCrest = envelopeBermCrestOuterVertices(axisRect, W);
    const innerCrest = envelopeBermCrestInnerVertices(axisRect, W);
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      expect(edgeLen(outerCrest[i]!, outerCrest[j]!)).toBeGreaterThan(
        edgeLen(innerCrest[i]!, innerCrest[j]!) - 0.01,
      );
      expect(edgeLen(innerCrest[i]!, innerCrest[j]!)).toBeGreaterThan(
        edgeLen(inner[i]!, inner[j]!) - 0.01,
      );
    }
  });

  it('inner slope connects sole inner to inner crest with 1:1 run H at edge mid (axis rect)', () => {
    const inner = envelopeBermSoleInnerVertices(axisRect, W);
    const ic = envelopeBermCrestInnerVertices(axisRect, W);
    const i = 0;
    const j = 1;
    const midInner = {
      east_m: (inner[i]!.east_m + inner[j]!.east_m) / 2,
      north_m: (inner[i]!.north_m + inner[j]!.north_m) / 2,
    };
    const midIc = {
      east_m: (ic[i]!.east_m + ic[j]!.east_m) / 2,
      north_m: (ic[i]!.north_m + ic[j]!.north_m) / 2,
    };
    const run = edgeLen(midInner, midIc);
    expect(run).toBeCloseTo(H, 1);
  });

  it('rotated pad inner crest vertices differ from sole inner', () => {
    const inner = envelopeBermSoleInnerVertices(rectangleSketch, W);
    const ic = envelopeBermCrestInnerVertices(rectangleSketch, W);
    expect(ic[0]!.east_m).not.toBeCloseTo(inner[0]!.east_m, 3);
  });
});
