import { describe, expect, it } from 'vitest';
import {
  mergeInfraPropertiesForSave,
  lineCoordsOrEndpoints,
  sameCoord,
  linkCoordMatch,
} from './MapPage';
import { makeInfraLine, makeInfraPoint } from '../test/fixtures/infra';

describe('MapPage helpers', () => {
  it('mergeInfraPropertiesForSave merges defaults', () => {
    const props = mergeInfraPropertiesForSave('gas_processing', { foo: 1 });
    expect(props).toBeDefined();
    expect(typeof props).toBe('object');
  });

  it('lineCoordsOrEndpoints from coordinates', () => {
    const line = makeInfraLine({
      coordinates: [
        [1, 2],
        [3, 4],
      ],
    });
    expect(lineCoordsOrEndpoints(line)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('lineCoordsOrEndpoints from endpoints', () => {
    const line = makeInfraPoint({
      end_lon: 37.7,
      end_lat: 55.76,
    });
    expect(lineCoordsOrEndpoints(line)).toEqual([
      [line.lon, line.lat],
      [37.7, 55.76],
    ]);
  });

  it('lineCoordsOrEndpoints returns null for point only', () => {
    expect(lineCoordsOrEndpoints(makeInfraPoint())).toBeNull();
  });

  it('sameCoord and linkCoordMatch compare coordinates', () => {
    expect(sameCoord(1, 1.0000001)).toBe(true);
    expect(linkCoordMatch(37.6000001, 37.6)).toBe(true);
  });
});
