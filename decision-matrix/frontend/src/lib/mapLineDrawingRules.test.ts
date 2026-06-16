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

/** Contract from docs/features/map/map-objects-and-spatial-calculations.md §1.4 */
describe('map line drawing rules (contract)', () => {
  const pad = pointObj('oil_pad', 'oil_pad', 37.6, 55.75);

  it('start requires exact point coords via icon click', () => {
    const snapped = snapLineDrawPoint(
      'oil_pipeline',
      [37.6001, 55.7501],
      [pad],
      { lon: 37.6, lat: 55.75, id: 'oil_pad' },
      'start',
    );
    expect(isLineEndpointSnapped('oil_pipeline', 'start', snapped, [pad])).toBe(true);
  });

  it('start away from point is not snapped', () => {
    const snapped = snapLineDrawPoint('oil_pipeline', [37.61, 55.76], [pad], null, 'start');
    expect(isLineEndpointSnapped('oil_pipeline', 'start', snapped, [pad])).toBe(false);
  });

  it('finish in empty space plans node creation', () => {
    const resolved = resolveLineEndpoint('power_line', 'finish', [38, 56], [pad]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.createNode).toBe(true);
  });

  it('finish with exact point coords attaches without new node', () => {
    const resolved = resolveLineEndpoint('power_line', 'finish', [37.6, 55.75], [pad]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(false);
      expect(resolved.lon).toBe(37.6);
      expect(resolved.lat).toBe(55.75);
    }
  });
});
