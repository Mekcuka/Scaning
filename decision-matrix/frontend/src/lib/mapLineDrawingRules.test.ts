import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import {
  isLineEndpointSnapped,
  resolveLineEndpoint,
  snapLineDrawPoint,
} from './lineEndpointRules';

const pointObj = (id: string, subtype: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: id,
    subtype,
    lon,
    lat,
  }) as InfraObject;

/** Contract from docs/map-objects-and-spatial-calculations.md §1.4 */
describe('map line drawing rules (contract)', () => {
  const pad = pointObj('pad', 'pad', 37.6, 55.75);

  it('start must snap to a point object (≤300 m)', () => {
    const snapped = snapLineDrawPoint('oil_pipeline', [37.6001, 55.7501], [pad], null, 'start');
    expect(isLineEndpointSnapped('oil_pipeline', 'start', snapped, [pad])).toBe(true);
  });

  it('finish in empty space plans node creation', () => {
    const resolved = resolveLineEndpoint('power_line', 'finish', [38, 56], [pad]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.createNode).toBe(true);
  });

  it('finish near object attaches without new node', () => {
    const resolved = resolveLineEndpoint('power_line', 'finish', [37.6001, 55.7501], [pad]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(false);
      expect(resolved.lon).toBe(37.6);
      expect(resolved.lat).toBe(55.75);
    }
  });
});
