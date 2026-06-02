import { describe, expect, it } from 'vitest';
import { MAP3D_LAYER_IDS, MAP3D_SOURCE_IDS } from './map3dConfig';
import { createMap3dBaseStyle } from './map3dBasemap';

describe('createMap3dBaseStyle', () => {
  it('includes Esri basemap by default', () => {
    const style = createMap3dBaseStyle();
    expect(style.sources?.[MAP3D_SOURCE_IDS.basemap]).toBeDefined();
    expect(style.layers?.some((l) => l.id === MAP3D_LAYER_IDS.basemap)).toBe(true);
  });

  it('omits basemap source when includeBasemap is false', () => {
    const style = createMap3dBaseStyle({ includeBasemap: false });
    expect(style.sources?.[MAP3D_SOURCE_IDS.basemap]).toBeUndefined();
    expect(style.layers?.some((l) => l.id === MAP3D_LAYER_IDS.basemap)).toBe(false);
  });
});
