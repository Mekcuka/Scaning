import { describe, expect, it } from 'vitest';
import l1Data from '../../../../shared/l1_extrusion_heights.json';
import { defaultHeightForSubtype } from './extrusionHeights';

describe('L1 extrusion heights sync', () => {
  it('matches shared JSON for every subtype', () => {
    for (const [subtype, height] of Object.entries(l1Data.heights)) {
      expect(defaultHeightForSubtype(subtype)).toBe(height);
    }
  });

  it('uses default for unknown subtype', () => {
    expect(defaultHeightForSubtype('unknown_subtype_xyz')).toBe(l1Data.default_height_m);
  });
});
