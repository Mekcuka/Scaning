import type { InfraObject } from '../../lib/api';

/** Minimal point infrastructure for map / export tests. */
export function makeInfraPoint(overrides: Partial<InfraObject> = {}): InfraObject {
  return {
    id: 'infra-1',
    layer_id: 'layer-1',
    name: 'Test point',
    subtype: 'gas_processing',
    category: 'point',
    lon: 37.6,
    lat: 55.75,
    end_lon: null,
    end_lat: null,
    coordinates: null,
    properties: {},
    description: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as InfraObject;
}

/** Minimal line infrastructure. */
export function makeInfraLine(overrides: Partial<InfraObject> = {}): InfraObject {
  return makeInfraPoint({
    id: 'line-1',
    name: 'Test road',
    subtype: 'autoroad',
    category: 'line',
    end_lon: 37.7,
    end_lat: 55.76,
    coordinates: [
      [37.6, 55.75],
      [37.7, 55.76],
    ],
    ...overrides,
  });
}
