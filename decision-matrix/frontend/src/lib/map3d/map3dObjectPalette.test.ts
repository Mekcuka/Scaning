import { describe, expect, it } from 'vitest';
import { buildObjectColorPalette, paletteRoleForMesh } from './map3dObjectPalette';

describe('buildObjectColorPalette', () => {
  it('returns distinct tones for each role', () => {
    const p = buildObjectColorPalette('#ff6f00');
    expect(p.pad.getHex()).not.toBe(p.roof.getHex());
    expect(p.body.getHex()).not.toBe(p.accent.getHex());
    expect(p.trim.getHex()).not.toBe(p.pad.getHex());
  });

  it('assigns chimney meshes to accent', () => {
    expect(paletteRoleForMesh('chimney-large', 0.5, 0)).toBe('accent');
    expect(paletteRoleForMesh('building-l', 0.05, 0)).toBe('pad');
    expect(paletteRoleForMesh('building-l', 0.95, 0)).toBe('trim');
  });
});
