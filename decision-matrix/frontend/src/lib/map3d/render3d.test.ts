import { describe, expect, it } from 'vitest';
import { catalogEntryForSubtype } from './map3dModelCatalog';
import {
  effectiveRender3dHeightM,
  RENDER_3D_HEIGHT_KEY,
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_SCALE_KEY,
  RENDER_3D_STYLE_KEY,
  resolveRender3D,
  shouldUse3dModel,
  withDefaultRender3DProperties,
} from './render3d';

describe('render3d', () => {
  it('uses L1 height when no override', () => {
    const r = resolveRender3D('substation', {});
    expect(r.heightM).toBe(10);
    expect(r.visible).toBe(true);
  });

  it('reads L2 height override', () => {
    const r = resolveRender3D('node', { [RENDER_3D_HEIGHT_KEY]: 25 });
    expect(r.heightM).toBe(25);
  });

  it('reads L2 scale override', () => {
    const r = resolveRender3D('node', { [RENDER_3D_SCALE_KEY]: 2.5 });
    expect(r.scale).toBe(2.5);
  });

  it('effectiveRender3dHeightM multiplies height by scale', () => {
    const r = resolveRender3D('gtes', {
      [RENDER_3D_HEIGHT_KEY]: 12,
      [RENDER_3D_SCALE_KEY]: 2,
    });
    expect(effectiveRender3dHeightM(r)).toBe(24);
  });

  it('defaults scale to 1', () => {
    expect(resolveRender3D('node', {}).scale).toBe(1);
  });

  it('can hide in 3D via render_3d_visible', () => {
    const r = resolveRender3D('node', { render_3d_visible: false });
    expect(r.visible).toBe(false);
  });

  it('withDefaultRender3DProperties fills missing keys', () => {
    const p = withDefaultRender3DProperties('oil_pipeline', {});
    expect(p[RENDER_3D_HEIGHT_KEY]).toBe(4);
    expect(p.render_3d_base_m).toBe(0);
    expect(p.render_3d_visible).toBe(true);
  });

  it('shouldUse3dModel for facility subtypes', () => {
    expect(shouldUse3dModel('gas_processing')).toBe(true);
    expect(catalogEntryForSubtype('gas_processing')?.template).toBe('facility');
  });

  it('oil_pad uses oil pump jack glTF', () => {
    expect(catalogEntryForSubtype('oil_pad')?.gltfAssetId).toBe('oil-pump-jack');
    expect(resolveRender3D('oil_pad', {}).heightM).toBe(8);
  });

  it('extrusion style disables model', () => {
    expect(shouldUse3dModel('substation', { [RENDER_3D_STYLE_KEY]: 'extrusion' })).toBe(false);
  });

  it('model style forces model when catalog exists', () => {
    expect(shouldUse3dModel('substation', { [RENDER_3D_STYLE_KEY]: 'model' })).toBe(true);
  });

  it('custom model id enables model path even before registry load', () => {
    expect(
      shouldUse3dModel('node', {
        [RENDER_3D_MODEL_ID_KEY]: 'custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        [RENDER_3D_STYLE_KEY]: 'model',
      }),
    ).toBe(true);
  });
});
