import { describe, expect, it } from 'vitest';
import {
  assignBottomholeWellIndices,
  bottomholesExternalToPad,
  bottomholesLinkedToPad,
  buildGsBottomholeConnectors,
  buildGsLineEndpointMovePayload,
  buildLateralBottomholeConnectors,
  gsLineEndpointPoints,
  parseGsLineEndpointFeatureId,
  isLateralBottomhole,
  lateralBottomholeIdsWithBranchCoverage,
  lateralBranchPlanEndpointsFromGeoJson,
  listBottomholesLinkedToPad,
  listProjectBottomholes,
  logicalWellCountFromBottomholes,
  orderBottomholesHierarchical,
  readBottomholeRole,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_WELL_INDEX,
  applyBottomholePropsPatch,
  bottomholePropertyValuesEqual,
  mergeBottomholeProperties,
  reconcileBottomholePropsPatch,
} from '../../wellBottomholeProperties';
import type { InfraObject } from '../../api';

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

describe('parseGsLineEndpointFeatureId', () => {
  it('parses synthetic heel and toe feature ids', () => {
    expect(parseGsLineEndpointFeatureId('gs-1:gs-heel')).toEqual({
      objectId: 'gs-1',
      endpoint: 'heel',
    });
    expect(parseGsLineEndpointFeatureId('gs-1:gs-toe')).toEqual({
      objectId: 'gs-1',
      endpoint: 'toe',
    });
    expect(parseGsLineEndpointFeatureId('gs-1')).toBeNull();
  });
});

describe('buildGsLineEndpointMovePayload', () => {
  it('updates heel while keeping toe', () => {
    const gs = {
      ...bottomhole('gs-1', 'well_bottomhole_gs', 37.62, 55.76),
      end_lon: 37.63,
      end_lat: 55.761,
    };
    expect(buildGsLineEndpointMovePayload(gs, 'heel', 37.621, 55.761)).toEqual({
      lon: 37.621,
      lat: 55.761,
      end_lon: 37.63,
      end_lat: 55.761,
      coordinates: [
        [37.621, 55.761],
        [37.63, 55.761],
      ],
    });
  });

  it('updates toe while keeping heel', () => {
    const gs = {
      ...bottomhole('gs-1', 'well_bottomhole_gs', 37.62, 55.76),
      end_lon: 37.63,
      end_lat: 55.761,
    };
    expect(buildGsLineEndpointMovePayload(gs, 'toe', 37.631, 55.762)).toEqual({
      lon: 37.62,
      lat: 55.76,
      end_lon: 37.631,
      end_lat: 55.762,
      coordinates: [
        [37.62, 55.76],
        [37.631, 55.762],
      ],
    });
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

  it('reads endpoints from coordinates when end_lon is missing', () => {
    const gs = {
      ...bottomhole('gs-1', 'well_bottomhole_gs', 37.62, 55.76),
      coordinates: [
        [37.62, 55.76],
        [37.631, 55.762],
      ],
    };
    expect(gsLineEndpointPoints(gs)).toEqual([
      expect.objectContaining({ id: 'gs-1:gs-heel', lon: 37.62, lat: 55.76 }),
      expect.objectContaining({ id: 'gs-1:gs-toe', lon: 37.631, lat: 55.762 }),
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

describe('listProjectBottomholes and bottomholesExternalToPad', () => {
  it('lists all bottomholes and excludes pad-linked set from external', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('pad-bh', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
      }),
      bottomhole('free-bh', 'well_bottomhole_nnb', 37.63, 55.76),
      bottomhole('road', 'oil_pipeline', 37.64, 55.76),
    ];
    expect(listProjectBottomholes(infra).map((o) => o.id).sort()).toEqual(['free-bh', 'pad-bh']);
    expect(bottomholesExternalToPad(infra, padId).map((o) => o.id)).toEqual(['free-bh']);
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

describe('bottomhole main/lateral chain', () => {
  it('includes lateral via parent in bottomholesLinkedToPad', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_ROLE]: 'main',
      }),
      bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
      }),
    ];
    const linked = bottomholesLinkedToPad(infra, padId);
    expect(linked.map((o) => o.id).sort()).toEqual(['lat-1', 'main-1']);
  });

  it('logicalWellCountFromBottomholes ignores lateral', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_ROLE]: 'main',
      }),
      bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.76, {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
      }),
    ];
    expect(logicalWellCountFromBottomholes(bottomholesLinkedToPad(infra, padId))).toBe(1);
  });

  it('assignBottomholeWellIndices gives lateral same slot as parent', () => {
    const padId = 'pad-1';
    const infra = bottomholesLinkedToPad(
      [
        bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
          [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
          [WELL_BOTTOMHOLE_WELL_INDEX]: 2,
          [WELL_BOTTOMHOLE_ROLE]: 'main',
        }),
        bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.76, {
          [WELL_BOTTOMHOLE_ROLE]: 'lateral',
          [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
        }),
      ],
      padId,
    );
    const map = assignBottomholeWellIndices(infra);
    expect(map.get('main-1')).toBe(2);
    expect(map.get('lat-1')).toBe(2);
  });

  it('orderBottomholesHierarchical nests lateral under main', () => {
    const padId = 'pad-1';
    const infra = bottomholesLinkedToPad(
      [
        bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
          [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
          [WELL_BOTTOMHOLE_ROLE]: 'main',
        }),
        bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.76, {
          [WELL_BOTTOMHOLE_ROLE]: 'lateral',
          [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
        }),
      ],
      padId,
    );
    expect(orderBottomholesHierarchical(infra).map((o) => o.id)).toEqual(['main-1', 'lat-1']);
  });

  it('buildLateralBottomholeConnectors links parent to lateral', () => {
    const infra = [
      bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_ROLE]: 'main',
      }),
      bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.77, {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
      }),
    ];
    const conns = buildLateralBottomholeConnectors(infra);
    expect(conns).toHaveLength(1);
    expect(conns[0]!.parentId).toBe('main-1');
    expect(conns[0]!.lateralId).toBe('lat-1');
  });

  it('buildLateralBottomholeConnectors skips laterals with PyWellGeo branch coverage', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('main-1', 'well_bottomhole_nnb', 37.62, 55.76, {
        [WELL_BOTTOMHOLE_ROLE]: 'main',
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
      }),
      bottomhole('lat-1', 'well_bottomhole_nnb', 37.63, 55.77, {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
      }),
    ];
    const branchFeatures = [
      {
        properties: {
          kind: 'pywellgeo_branch',
          infra_object_id: padId,
          well_index: 0,
        },
        geometry: {
          coordinates: [
            [37.62, 55.76],
            [37.63, 55.77],
          ],
        },
      },
    ];
    const covered = lateralBottomholeIdsWithBranchCoverage(
      infra,
      lateralBranchPlanEndpointsFromGeoJson(branchFeatures),
    );
    expect(covered.has('lat-1')).toBe(true);
    expect(
      buildLateralBottomholeConnectors(infra, { excludeLateralIds: covered }),
    ).toHaveLength(0);
    expect(buildLateralBottomholeConnectors(infra)).toHaveLength(1);
  });

  it('readBottomholeRole defaults to main', () => {
    expect(readBottomholeRole({})).toBe('main');
    expect(isLateralBottomhole({ id: 'x', subtype: 'well_bottomhole_nnb', lon: 0, lat: 0, properties: { [WELL_BOTTOMHOLE_ROLE]: 'lateral' } } as never)).toBe(true);
  });
});

describe('bottomhole property patch helpers', () => {
  it('mergeBottomholeProperties applies patch over base and drops cleared keys', () => {
    const merged = mergeBottomholeProperties(
      { [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400, [WELL_BOTTOMHOLE_WELL_INDEX]: 2 },
      { [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500, [WELL_BOTTOMHOLE_WELL_INDEX]: undefined },
    );
    expect(merged[WELL_BOTTOMHOLE_HEEL_TVD_M]).toBe(1500);
    expect(merged[WELL_BOTTOMHOLE_WELL_INDEX]).toBeUndefined();
  });

  it('applyBottomholePropsPatch removes cleared keys from previous patch', () => {
    const next = applyBottomholePropsPatch(
      { [WELL_BOTTOMHOLE_WELL_INDEX]: 3, [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400 },
      { [WELL_BOTTOMHOLE_WELL_INDEX]: undefined, [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500 },
    );
    expect(next).toEqual({ [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500 });
  });

  it('bottomholePropertyValuesEqual treats numeric strings as equal', () => {
    expect(bottomholePropertyValuesEqual(5, '5')).toBe(true);
    expect(bottomholePropertyValuesEqual(1500, 1600)).toBe(false);
  });

  it('reconcileBottomholePropsPatch drops entries matching server', () => {
    const patch = { [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500, [WELL_BOTTOMHOLE_WELL_INDEX]: 2 };
    const server = { [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500, [WELL_BOTTOMHOLE_WELL_INDEX]: 1 };
    expect(reconcileBottomholePropsPatch(server, patch)).toEqual({
      [WELL_BOTTOMHOLE_WELL_INDEX]: 2,
    });
  });
});
