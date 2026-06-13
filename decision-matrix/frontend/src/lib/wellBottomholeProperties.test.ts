import { describe, expect, it } from 'vitest';
import { buildGsBottomholeConnectors, WELL_BOTTOMHOLE_GS_HEEL_ID } from './wellBottomholeProperties';
import type { InfraObject } from './api';

function bottomhole(
  id: string,
  subtype: string,
  lon: number,
  lat: number,
  properties?: Record<string, unknown>,
): InfraObject {
  return {
    id,
    layer_id: 'layer-1',
    name: id,
    subtype,
    category: 'well',
    lon,
    lat,
    properties,
  };
}

describe('buildGsBottomholeConnectors', () => {
  it('links toe to heel by gs_heel_id', () => {
    const infra = [
      bottomhole('heel-1', 'well_bottomhole_gs_heel', 37.62, 55.76),
      bottomhole('toe-1', 'well_bottomhole_gs_toe', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel-1',
      }),
    ];
    const connectors = buildGsBottomholeConnectors(infra);
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({
      id: 'gs-bottomhole:toe-1',
      heelId: 'heel-1',
      toeId: 'toe-1',
      coordinates: [
        [37.62, 55.76],
        [37.63, 55.76],
      ],
    });
  });

  it('skips toe when heel is missing', () => {
    const infra = [
      bottomhole('toe-1', 'well_bottomhole_gs_toe', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'missing-heel',
      }),
    ];
    expect(buildGsBottomholeConnectors(infra)).toEqual([]);
  });
});
