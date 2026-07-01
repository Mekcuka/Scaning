import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import {
  powerLineVertexHasTower,
  resolvePowerLineWireEndpoint,
} from '../map3dPowerLineEndpoints';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

describe('map3dPowerLineEndpoints', () => {
  it('skips towers on first and last vertices when path has 3+ points', () => {
    expect(powerLineVertexHasTower(0, 3)).toBe(false);
    expect(powerLineVertexHasTower(1, 3)).toBe(true);
    expect(powerLineVertexHasTower(2, 3)).toBe(false);
  });

  it('skips all towers on two-vertex span', () => {
    expect(powerLineVertexHasTower(0, 2)).toBe(false);
    expect(powerLineVertexHasTower(1, 2)).toBe(false);
  });

  it('uses attached object center for wire endpoint', () => {
    const substation: InfraObject = {
      id: 'sub-1',
      layer_id: 'layer-1',
      name: 'ПС',
      subtype: 'substation',
      category: 'point',
      lon: 37.6,
      lat: 55.7,
      properties: { render_3d_height_m: 20, render_3d_base_m: 10 },
    };
    const ep = resolvePowerLineWireEndpoint(
      fakeMap(),
      [37.601, 55.701],
      50,
      { object: substation, lon: substation.lon, lat: substation.lat },
    );
    expect(ep.lon).toBe(37.6);
    expect(ep.lat).toBe(55.7);
    expect(ep.altM).toBe(10 + 20 * 5 * 0.88);
  });
});
