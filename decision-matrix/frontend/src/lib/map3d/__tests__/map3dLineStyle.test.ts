import { describe, expect, it } from 'vitest';
import { resolveLine3dVisualStyle } from '../map3dLineStyle';

describe('resolveLine3dVisualStyle', () => {
  it('uses few segments for roads (flat ribbon look)', () => {
    const s = resolveLine3dVisualStyle('autoroad', false);
    expect(s.radialSegments).toBeLessThanOrEqual(6);
  });

  it('boosts radius when selected', () => {
    const base = resolveLine3dVisualStyle('gas_pipeline', false);
    const sel = resolveLine3dVisualStyle('gas_pipeline', true);
    expect(sel.radiusMul).toBeGreaterThan(base.radiusMul);
  });
});
