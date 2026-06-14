import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import {
  infraObjectInBbox,
  isPadPlacementBottomhole,
  mergeBottomholeIds,
} from './padPlacementEligibility';

function bottomhole(overrides: Partial<InfraObject> = {}): InfraObject {
  return {
    id: 'bh-1',
    layer_id: 'layer-1',
    name: 'Забой 1',
    subtype: 'well_bottomhole_nnb',
    category: 'point',
    lon: 50,
    lat: 55,
    properties: {},
    ...overrides,
  } as InfraObject;
}

describe('isPadPlacementBottomhole', () => {
  it('accepts NNB and GS heel bottomholes only', () => {
    expect(isPadPlacementBottomhole(bottomhole())).toBe(true);
    expect(isPadPlacementBottomhole(bottomhole({ subtype: 'well_bottomhole_gs_heel' }))).toBe(true);
    expect(isPadPlacementBottomhole(bottomhole({ subtype: 'node' }))).toBe(false);
  });
});

describe('infraObjectInBbox', () => {
  const bbox: [number, number, number, number] = [49, 54, 51, 56];

  it('uses lon/lat from InfraObject', () => {
    expect(infraObjectInBbox(bottomhole({ lon: 50, lat: 55 }), bbox)).toBe(true);
    expect(infraObjectInBbox(bottomhole({ lon: 48, lat: 55 }), bbox)).toBe(false);
  });
});

describe('mergeBottomholeIds', () => {
  it('toggles id in list', () => {
    expect(mergeBottomholeIds([], 'a')).toEqual(['a']);
    expect(mergeBottomholeIds(['a'], 'a')).toEqual([]);
  });
});
