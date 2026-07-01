import { describe, expect, it } from 'vitest';
import { catalogEntryForSubtype } from '../map3dModelCatalog';
import { POWER_LINE_TOWER_GLTF_ID } from '../map3dPowerLineStyle';

describe('map3dModelCatalog power_line_node', () => {
  it('maps power_line_node to transmission-tower glTF', () => {
    const entry = catalogEntryForSubtype('power_line_node');
    expect(entry).not.toBeNull();
    expect(entry!.gltfAssetId).toBe(POWER_LINE_TOWER_GLTF_ID);
    expect(entry!.template).toBe('tall_stack');
  });
});
