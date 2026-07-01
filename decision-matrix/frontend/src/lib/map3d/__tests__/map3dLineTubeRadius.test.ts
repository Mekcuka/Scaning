import { describe, expect, it } from 'vitest';
import {
  defaultLineDiameterM,
  effectiveLineDiameterM,
  resolveLineTubeRadiusM,
} from '../map3dLineTubeRadius';
import { resolveRender3D } from '../render3d';

describe('resolveLineTubeRadiusM', () => {
  it('uses catalog diameter when render_3d_diameter_m is absent', () => {
    const render = resolveRender3D('autoroad', { render_3d_height_m: 0.8 });
    expect(defaultLineDiameterM('autoroad')).toBe(8);
    expect(effectiveLineDiameterM('autoroad', render)).toBe(8);
    expect(resolveLineTubeRadiusM('autoroad', render)).toBeGreaterThan(0);
  });

  it('uses explicit render_3d_diameter_m', () => {
    const render = resolveRender3D('autoroad', {
      render_3d_diameter_m: 2,
      render_3d_scale: 1,
    });
    const radius = resolveLineTubeRadiusM('autoroad', render);
    // diameter 2 m → radius 1 m × MAP3D_OBJECT_SCALE (5)
    expect(radius).toBe(5);
  });

  it('legacy: non-L1 height without diameter is treated as diameter', () => {
    const render = resolveRender3D('autoroad', { render_3d_height_m: 2, render_3d_scale: 1 });
    expect(effectiveLineDiameterM('autoroad', render)).toBe(2);
    expect(resolveLineTubeRadiusM('autoroad', render)).toBe(5);
  });

  it('scales explicit diameter with render_3d_scale', () => {
    const base = resolveLineTubeRadiusM(
      'oil_pipeline',
      resolveRender3D('oil_pipeline', { render_3d_diameter_m: 5, render_3d_scale: 1 }),
    );
    const doubled = resolveLineTubeRadiusM(
      'oil_pipeline',
      resolveRender3D('oil_pipeline', { render_3d_diameter_m: 5, render_3d_scale: 2 }),
    );
    expect(doubled).toBeGreaterThan(base);
  });
});
