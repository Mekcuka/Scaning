import { describe, expect, it } from 'vitest';
import { generatePadFromWells, type PlanVertex } from '../../padEarthworkSketch';
import { isPersistedLayoutStale, wellsLocalMatch } from '../padClusteringLayoutSync';

describe('padClusteringLayoutSync', () => {
  const layoutInput = {
    wellCount: 12,
    wellsPerGroup: 1,
    wellSpacingM: 9,
    groupSpacingM: 9,
    margins: { leftM: 27, bottomM: 43, topM: 15, endM: 70 },
    rotationDeg: 90,
  };

  it('detects stale wells when count differs from preview', () => {
    const preview = generatePadFromWells(layoutInput);
    const savedTwo: PlanVertex[] = [
      { east_m: 0, north_m: 0 },
      { east_m: 9, north_m: 0 },
    ];
    expect(isPersistedLayoutStale(savedTwo, preview.sketch, preview)).toBe(true);
  });

  it('accepts matching saved layout', () => {
    const preview = generatePadFromWells(layoutInput);
    expect(
      isPersistedLayoutStale(preview.wellsLocal, preview.sketch, preview),
    ).toBe(false);
  });

  it('wellsLocalMatch compares coordinates', () => {
    const a = [{ east_m: 0, north_m: 0 }, { east_m: 9, north_m: 0 }];
    const b = [{ east_m: 0, north_m: 0 }, { east_m: 9, north_m: 0 }];
    expect(wellsLocalMatch(a, b)).toBe(true);
    expect(wellsLocalMatch(a, [{ east_m: 0, north_m: 1 }])).toBe(false);
  });
});
