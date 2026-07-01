import { describe, expect, it } from 'vitest';
import {
  buildPlanSketchViewBox,
  clampPlanSketchZoom,
  planSketchGridLines,
  zoomPlanSketchAtWorldPoint,
} from '../planSketchViewport';

describe('planSketchViewport', () => {
  it('buildPlanSketchViewBox offsets by pan', () => {
    expect(buildPlanSketchViewBox(10, -5, 50)).toBe('-40 -45 100 100');
  });

  it('clampPlanSketchZoom respects bounds', () => {
    expect(clampPlanSketchZoom(0.1)).toBe(0.25);
    expect(clampPlanSketchZoom(20)).toBe(8);
  });

  it('zoomPlanSketchAtWorldPoint keeps anchor fixed', () => {
    const start = { zoom: 1, pan: { east_m: 0, north_m: 0 } };
    const viewHalf = 100;
    const next = zoomPlanSketchAtWorldPoint(
      start.zoom,
      viewHalf,
      start.pan,
      20,
      10,
      2,
    );
    expect(next.zoom).toBe(2);
    expect(next.pan.east_m).toBeCloseTo(10, 5);
    expect(next.pan.north_m).toBeCloseTo(5, 5);
  });

  it('planSketchGridLines covers visible extent', () => {
    const lines = planSketchGridLines(0, 0, 10, 5);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.x1 === 0 && line.x2 === 0)).toBe(true);
  });
});
