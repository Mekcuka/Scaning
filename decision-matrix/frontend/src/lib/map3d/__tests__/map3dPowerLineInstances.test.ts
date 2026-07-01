import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import { buildMap3dPowerLineInstances } from '../map3dPowerLineInstances';
import { buildMap3dLineInstances } from '../map3dLineInstances';
import { buildMap3dLineLayerData } from '../map3dLineLayerData';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const powerLine: InfraObject = {
  id: 'pl-1',
  layer_id: 'layer-1',
  name: 'ЛЭП',
  subtype: 'power_line',
  category: 'linear',
  lon: 37.6,
  lat: 55.7,
  properties: {},
  coordinates: [
    [37.6, 55.7],
    [37.61, 55.71],
    [37.62, 55.72],
  ],
};

describe('buildMap3dPowerLineInstances', () => {
  it('builds power line with tower height from render_3d', () => {
    const instances = buildMap3dPowerLineInstances(fakeMap(), {
      infraObjects: [powerLine],
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]!.path).toHaveLength(3);
    expect(instances[0]!.towerHeightM).toBeGreaterThan(0);
    expect(instances[0]!.startWire.lon).toBe(37.6);
    expect(instances[0]!.finishWire.lon).toBe(37.62);
  });

  it('excludes power_line from tube instances', () => {
    const map = fakeMap();
    expect(buildMap3dLineInstances(map, { infraObjects: [powerLine] })).toHaveLength(0);
    const data = buildMap3dLineLayerData(map, { infraObjects: [powerLine] });
    expect(data.tubes).toHaveLength(0);
    expect(data.powerLines).toHaveLength(1);
  });
});
