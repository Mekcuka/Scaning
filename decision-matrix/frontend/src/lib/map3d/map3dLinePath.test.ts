import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { snapLinePathEndpoints } from './map3dLinePath';
// snapLinePathEndpoints is an alias of normalizeLinePathEndpoints

const point = (id: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: id,
    subtype: 'pad',
    category: 'point',
    lon,
    lat,
    layer_id: 'l1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

describe('snapLinePathEndpoints', () => {
  it('moves endpoints to attached point object coordinates', () => {
    const pad = point('pad-1', 37.6, 55.75);
    const path = snapLinePathEndpoints(
      'power_line',
      [
        [37.6001, 55.7501],
        [37.62, 55.76],
      ],
      [pad],
    );
    expect(path[0]).toEqual([37.6, 55.75]);
    expect(path[1]).toEqual([37.62, 55.76]);
  });
});
