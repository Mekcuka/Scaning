import { describe, expect, it } from 'vitest';
import type { InfraObject, InfraLayer } from '../api';
import { buildMap3dGeoJson } from './geoJson';
import { RENDER_3D_HEIGHT_KEY } from './render3d';

const baseInfra: InfraObject = {
  id: 'line-1',
  layer_id: 'layer-1',
  name: 'Pipe',
  subtype: 'oil_pipeline',
  category: 'linear',
  lon: 37.6,
  lat: 55.75,
  properties: {},
};

describe('buildMap3dGeoJson', () => {
  it('builds line from coordinates', () => {
    const obj: InfraObject = {
      ...baseInfra,
      coordinates: [
        [37.6, 55.75],
        [37.61, 55.76],
        [37.62, 55.77],
      ],
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [] });
    expect(bundle.infraLines.features).toHaveLength(1);
    expect(bundle.infraLines.features[0]!.geometry.coordinates).toHaveLength(3);
    expect(bundle.infraExtrusions.features).toHaveLength(0);
  });

  it('builds line from end_lon/end_lat', () => {
    const obj: InfraObject = {
      ...baseInfra,
      coordinates: undefined,
      end_lon: 37.65,
      end_lat: 55.8,
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [] });
    expect(bundle.infraLines.features[0]!.geometry.coordinates).toEqual([
      [37.6, 55.75],
      [37.65, 55.8],
    ]);
  });

  it('uses 3D model catalog for gas_processing (no extrusion footprint)', () => {
    const obj: InfraObject = {
      ...baseInfra,
      id: 'pt-1',
      subtype: 'gas_processing',
      coordinates: undefined,
      end_lon: null,
      end_lat: null,
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [] });
    expect(bundle.infraExtrusions.features).toHaveLength(0);
    expect(bundle.infraPoints.features).toHaveLength(1);
    expect(bundle.infraLines.features).toHaveLength(0);
  });

  it('builds extrusion when render_3d_style is extrusion', () => {
    const obj: InfraObject = {
      ...baseInfra,
      id: 'pt-2',
      subtype: 'gas_processing',
      coordinates: undefined,
      end_lon: null,
      end_lat: null,
      properties: { render_3d_style: 'extrusion' },
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [] });
    expect(bundle.infraExtrusions.features).toHaveLength(1);
  });

  it('omits objects on hidden layer', () => {
    const layers: InfraLayer[] = [
      {
        id: 'layer-1',
        project_id: 'p1',
        name: 'L1',
        layer_type: 'infrastructure',
        source_type: 'manual',
        is_visible: false,
        opacity: 1,
        sort_order: 0,
        style_config: {},
      },
    ];
    const obj: InfraObject = {
      ...baseInfra,
      coordinates: [
        [37.6, 55.75],
        [37.61, 55.76],
      ],
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [], layers });
    expect(bundle.infraLines.features).toHaveLength(0);
  });

  it('includes POI points and extrusions', () => {
    const bundle = buildMap3dGeoJson({
      infraObjects: [],
      pois: [
        {
          id: 'poi-1',
          project_id: 'p1',
          name: 'POI',
          lon: 37.5,
          lat: 55.7,
          planned_production_volume: 1,
          production_per_well: 1,
          wells_per_pad: 1,
          fluid_type: 'oil',
          water_injection_volume: 0,
          gas_factor: 0,
          eng_power: 'no',
          eng_injection: 'no',
          eng_gas: 'no',
          eng_oil_preparation: 'no',
          eng_well_gathering: 'no',
          eng_transport: 'no',
          pads_count: 1,
          wells_total: 1,
        },
      ],
    });
    expect(bundle.pois.features).toHaveLength(1);
    expect(bundle.infraExtrusions.features.some((f) => f.properties?.featureKind === 'poi')).toBe(
      false,
    );
  });

  it('respects render_3d_height_m override on extrusion style', () => {
    const obj: InfraObject = {
      ...baseInfra,
      id: 'pt-2',
      subtype: 'substation',
      coordinates: undefined,
      end_lon: null,
      end_lat: null,
      properties: { [RENDER_3D_HEIGHT_KEY]: 25, render_3d_style: 'extrusion' },
    };
    const bundle = buildMap3dGeoJson({ infraObjects: [obj], pois: [] });
    expect(bundle.infraExtrusions.features[0]!.properties?.extrusion_height_m).toBe(125);
  });
});
