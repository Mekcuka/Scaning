import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import { buildMap3dGeoJson } from '../geoJson';
import { buildMap3dLineLayerData } from '../map3dLineLayerData';
import { buildMap3dModelInstances } from '../map3dModelInstances';
import { shouldBuildPointExtrusion, shouldUse3dModel } from '../render3d';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const substation: InfraObject = {
  id: 'sub-1',
  layer_id: 'layer-1',
  name: 'ПС',
  subtype: 'substation',
  category: 'point',
  lon: 37.6,
  lat: 55.7,
  properties: {},
};

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

describe('3D render deduplication', () => {
  it('catalog point: model on + no extrusion', () => {
    expect(shouldUse3dModel('substation', {})).toBe(true);
    expect(shouldBuildPointExtrusion('substation', {}, true)).toBe(false);

    const bundle = buildMap3dGeoJson({
      infraObjects: [substation],
      pois: [],
      showModels: true,
    });
    expect(bundle.infraExtrusions.features).toHaveLength(0);
    expect(
      buildMap3dModelInstances({ infraObjects: [substation], pois: [], showModels: true }),
    ).toHaveLength(1);
  });

  it('catalog point: models off → extrusion, not glTF instance', () => {
    expect(shouldBuildPointExtrusion('substation', {}, false)).toBe(true);

    const bundle = buildMap3dGeoJson({
      infraObjects: [substation],
      pois: [],
      showModels: false,
    });
    expect(bundle.infraExtrusions.features).toHaveLength(1);
    expect(
      buildMap3dModelInstances({ infraObjects: [substation], pois: [], showModels: false }),
    ).toHaveLength(0);
  });

  it('power_line is not in tube layer and not duplicated in line instances', () => {
    const map = fakeMap();
    const data = buildMap3dLineLayerData(map, { infraObjects: [powerLine] });
    expect(data.tubes).toHaveLength(0);
    expect(data.powerLines).toHaveLength(1);
    expect(data.tubes.some((t) => t.subtype === 'power_line')).toBe(false);
  });

  it('extrusion style never uses glTF path', () => {
    const props = { render_3d_style: 'extrusion' };
    expect(shouldUse3dModel('substation', props)).toBe(false);
    expect(shouldBuildPointExtrusion('substation', props, true)).toBe(true);
    expect(
      buildMap3dModelInstances({
        infraObjects: [{ ...substation, properties: props }],
        pois: [],
        showModels: true,
      }),
    ).toHaveLength(0);
  });
});
