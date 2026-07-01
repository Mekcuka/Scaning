import { describe, expect, it } from 'vitest';
import { maptilerTerrainTilesUrl } from '../map3dTerrain';

describe('maptilerTerrainTilesUrl', () => {
  it('embeds key in terrain tiles URL', () => {
    const url = maptilerTerrainTilesUrl('test-key-123');
    expect(url).toContain('terrain-rgb-v2');
    expect(url).toContain('key=test-key-123');
  });
});
