import { describe, expect, it } from 'vitest';
import {
  bottomholesLinkedToPad,
  buildGsBottomholeConnectors,
  gsLineEndpointPoints,
  listBottomholesLinkedToPad,
  logicalWellCountFromBottomholes,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_WELL_INDEX,
} from './wellBottomholeProperties';
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

describe('gsLineEndpointPoints', () => {
  it('returns heel and toe markers for unified GS line', () => {
    const gs = {
      ...bottomhole('gs-1', 'well_bottomhole_gs', 37.62, 55.76),
      end_lon: 37.63,
      end_lat: 55.761,
    };
    expect(gsLineEndpointPoints(gs)).toEqual([
      {
        id: 'gs-1:gs-heel',
        lon: 37.62,
        lat: 55.76,
        subtype: 'well_bottomhole_gs_heel',
      },
      {
        id: 'gs-1:gs-toe',
        lon: 37.63,
        lat: 55.761,
        subtype: 'well_bottomhole_gs_toe',
      },
    ]);
  });
});

describe('bottomholesLinkedToPad', () => {
  it('includes GS toe when only heel is linked to pad', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('heel-1', 'well_bottomhole_gs_heel', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
      }),
      bottomhole('toe-1', 'well_bottomhole_gs_toe', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel-1',
      }),
    ];
    expect(listBottomholesLinkedToPad(infra, padId)).toHaveLength(1);
    expect(bottomholesLinkedToPad(infra, padId).map((o) => o.id).sort()).toEqual(['heel-1', 'toe-1']);
  });
});

describe('logicalWellCountFromBottomholes', () => {
  it('counts unassigned NNB bottomholes', () => {
    const padId = 'pad-1';
    const infra = Array.from({ length: 6 }, (_, i) =>
      bottomhole(`bh-${i}`, 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
      }),
    );
    expect(logicalWellCountFromBottomholes(listBottomholesLinkedToPad(infra, padId))).toBe(6);
  });

  it('counts GS heel as one well and ignores toe', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('heel-1', 'well_bottomhole_gs_heel', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
      }),
      bottomhole('toe-1', 'well_bottomhole_gs_toe', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel-1',
      }),
    ];
    expect(logicalWellCountFromBottomholes(listBottomholesLinkedToPad(infra, padId))).toBe(1);
  });

  it('uses explicit well_index when higher than object count', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('bh-0', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_WELL_INDEX]: 5,
      }),
    ];
    expect(logicalWellCountFromBottomholes(listBottomholesLinkedToPad(infra, padId))).toBe(6);
  });
});
