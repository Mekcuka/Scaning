import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import { buildProjectGeoJson } from '../geoJson';

const pointObj: InfraObject = {
  id: 'p1',
  layer_id: 'l1',
  name: 'GKS-1',
  subtype: 'gas_processing',
  category: 'point',
  lon: 38.05,
  lat: 56.02,
  properties: { render_3d_height_m: 12 },
};

const lineObj: InfraObject = {
  id: 'l1',
  layer_id: 'l1',
  name: 'Road-1',
  subtype: 'autoroad',
  category: 'line',
  lon: 38.06,
  lat: 56.02,
  end_lon: 38.07,
  end_lat: 56.03,
  coordinates: [
    [38.06, 56.02],
    [38.065, 56.025],
    [38.07, 56.03],
  ],
};

describe('buildProjectGeoJson', () => {
  it('builds Point feature for point infrastructure', () => {
    const fc = buildProjectGeoJson([pointObj]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [38.05, 56.02],
    });
    expect(fc.features[0]?.properties).toMatchObject({
      name: 'GKS-1',
      subtype: 'gas_processing',
      render_3d_height_m: 12,
    });
  });

  it('builds LineString feature with stored vertices', () => {
    const fc = buildProjectGeoJson([lineObj]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: lineObj.coordinates,
    });
    expect(fc.features[0]?.properties).toMatchObject({
      name: 'Road-1',
      subtype: 'autoroad',
    });
  });

  it('skips lines without enough coordinates', () => {
    const broken: InfraObject = {
      ...lineObj,
      id: 'broken',
      coordinates: null,
      end_lon: null,
      end_lat: null,
    };
    const fc = buildProjectGeoJson([broken]);
    expect(fc.features).toHaveLength(0);
  });
});
