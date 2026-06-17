import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import {
  bottomholeTargetsExternal,
  bottomholeTargetsForWell,
  bottomholeTargetMarkerColor,
  buildBottomholeSelectOptions,
  buildBottomholeTargetCatalog,
  lateralBottomholeTargetsForWell,
  filterTreeNodes,
  groupTreeNodes,
  isBottomholeTargetSelectable,
  lateralXyzFromAzimDip,
  parseXyzLines,
} from './padClusteringPyWellGeoLateral';
import { emptyTreeNode, flattenTree } from './padClusteringPyWellGeoSettings';
import {
  bottomholesLinkedToPad,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
} from '../wellBottomholeProperties';

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

describe('padClusteringPyWellGeoLateral', () => {
  it('builds lateral polyline from azim/dip', () => {
    const pts = lateralXyzFromAzimDip({ x: 0, y: 0, z: -1000 }, 90, 0, 100, 2);
    expect(pts.length).toBe(3);
    expect(pts[0]).toEqual([0, 0, -1000]);
    expect(pts[2]![0]).toBeGreaterThan(pts[0]![0]!);
  });

  it('parses xyz lines', () => {
    expect(parseXyzLines('0,0,-100\n10,0,-100')).toHaveLength(2);
  });

  it('filters branch-only nodes', () => {
    let root = emptyTreeNode();
    root = {
      ...root,
      branches: [
        { ...emptyTreeNode('main'), x: 0, y: 0, z: -50, branches: [{ ...emptyTreeNode('main'), x: 0, y: 10, z: -100, branches: [] }] },
        { ...emptyTreeNode('lat1'), x: 10, branches: [] },
      ],
    };
    const flat = flattenTree(root);
    expect(filterTreeNodes(flat, 'branches_only', root)).toHaveLength(1);
    expect(filterTreeNodes(flat, 'all', root)).toHaveLength(4);
    expect(filterTreeNodes(flat, 'main_and_kickoffs', root)).toHaveLength(4);
  });

  it('main_and_kickoffs includes full lateral polyline chain (branches[0])', () => {
    const root = {
      ...emptyTreeNode('main'),
      branches: [
        { ...emptyTreeNode('main'), x: 0, branches: [] },
        {
          ...emptyTreeNode('lat1'),
          x: 10,
          branches: [
            {
              ...emptyTreeNode('lat1'),
              x: 20,
              branches: [{ ...emptyTreeNode('lat1'), x: 30, branches: [] }],
            },
          ],
        },
      ],
    };
    const flat = flattenTree(root);
    expect(filterTreeNodes(flat, 'main_and_kickoffs', root)).toHaveLength(5);
    const lateralGroup = groupTreeNodes(filterTreeNodes(flat, 'main_and_kickoffs', root), root)[1]!;
    expect(lateralGroup.nodes).toHaveLength(3);
  });

  it('groups main-bore chain under Ствол (PyWellGeo branches[0] chain)', () => {
    const root: import('./api/pywellgeoApi').PyWellGeoTreeNode = {
      x: 0,
      y: 0,
      z: 0,
      radius: 0.1,
      perforated: false,
      color: 'black',
      name: 'main',
      branches: [
        {
          x: 0,
          y: 0,
          z: -50,
          radius: 0.1,
          perforated: false,
          color: 'black',
          name: 'main',
          branches: [
            {
              x: 0,
              y: 10,
              z: -100,
              radius: 0.1,
              perforated: false,
              color: 'black',
              name: 'main',
              branches: [],
            },
          ],
        },
      ],
    };
    const flat = flattenTree(root);
    const groups = groupTreeNodes(flat, root);
    expect(groups[0]!.title).toBe('Ствол');
    expect(groups[0]!.nodes).toHaveLength(3);
    expect(groups).toHaveLength(1);
  });

  it('lists bottomholes for well with explicit and auto-assigned indices', () => {
    const holes = [
      bottomhole('bh-main', 'well_bottomhole_nnb', 37.621, 55.741, {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_TVD_M]: 2200,
      }),
      bottomhole('bh-lat', 'well_bottomhole_nnb', 37.622, 55.742, {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_TVD_M]: 2200,
      }),
      bottomhole('bh-w2', 'well_bottomhole_nnb', 37.623, 55.743, {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 1,
        [WELL_BOTTOMHOLE_TVD_M]: 2100,
      }),
    ];
    const skv1 = bottomholeTargetsForWell(holes, 0, 37.62, 55.74);
    expect(skv1).toHaveLength(2);
    expect(skv1.every((t) => t.wellIndex === 0)).toBe(true);
    expect(skv1.every((t) => t.source === 'pad')).toBe(true);
    expect(skv1.every((t) => Number.isFinite(t.x) && Number.isFinite(t.y))).toBe(true);
    expect(skv1[0]!.x).not.toBe(0);
    expect(bottomholeTargetsForWell(holes, 1, 37.62, 55.74)).toHaveLength(1);
  });

  it('inherits GS toe well index from heel', () => {
    const holes = [
      bottomhole('heel', 'well_bottomhole_gs_heel', 37.621, 55.741, {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_TVD_M]: 2000,
      }),
      bottomhole('toe', 'well_bottomhole_gs_toe', 37.625, 55.745, {
        [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel',
        [WELL_BOTTOMHOLE_TVD_M]: 2100,
      }),
    ];
    const targets = bottomholeTargetsForWell(holes, 0, 37.62, 55.74);
    expect(targets.map((t) => t.id).sort()).toEqual(['heel', 'toe']);
  });

  it('builds catalog with pad and external targets', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('pad-bh', 'well_bottomhole_nnb', 37.621, 55.741, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_TVD_M]: 2200,
      }),
      bottomhole('ext-bh', 'well_bottomhole_nnb', 37.631, 55.751, {
        [WELL_BOTTOMHOLE_TVD_M]: 2100,
      }),
      bottomhole('other-pad', 'well_bottomhole_nnb', 37.641, 55.761, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'pad-2',
        [WELL_BOTTOMHOLE_TVD_M]: 2050,
      }),
    ];
    const catalog = buildBottomholeTargetCatalog(infra, padId, 37.62, 55.74);
    expect(catalog.padTargets).toHaveLength(1);
    expect(catalog.padTargets[0]!.id).toBe('pad-bh');
    expect(catalog.externalTargets).toHaveLength(2);
    expect(catalog.externalTargets.every((t) => t.source === 'project')).toBe(true);
    expect(catalog.externalTargets.every((t) => Number.isFinite(t.x))).toBe(true);
  });

  it('builds grouped select options with all pad targets selectable', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('pad-bh', 'well_bottomhole_nnb', 37.621, 55.741, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_WELL_INDEX]: 1,
        [WELL_BOTTOMHOLE_TVD_M]: 2200,
      }),
      bottomhole('ext-bh', 'well_bottomhole_nnb', 37.631, 55.751, {
        [WELL_BOTTOMHOLE_TVD_M]: 2100,
      }),
    ];
    const { padTargets, externalTargets } = buildBottomholeTargetCatalog(infra, padId, 37.62, 55.74);
    const options = buildBottomholeSelectOptions(padTargets, externalTargets, 0);
    expect(options.some((o) => o.label === 'Забои этой скважины')).toBe(false);
    expect(options.some((o) => o.label === 'Другие забои куста' && o.disabled)).toBe(true);
    expect(options.some((o) => o.label === 'Другие забои проекта' && o.disabled)).toBe(true);
    const padOption = options.find((o) => o.value === 'pad-bh');
    expect(padOption?.disabled).toBeFalsy();
    expect(padOption?.label).toContain('(design)');
    const extOption = options.find((o) => o.value === 'ext-bh');
    expect(extOption?.disabled).toBeFalsy();
    expect(isBottomholeTargetSelectable(padTargets[0]!, 0)).toBe(true);
  });

  it('returns marker colors by target slot and source', () => {
    const padTargetSame: import('./padClusteringPyWellGeoLateral').BottomholeTarget = {
      id: 'a',
      label: 'A',
      x: 0,
      y: 0,
      z: -100,
      wellIndex: 0,
      source: 'pad',
    };
    const padTargetOther: import('./padClusteringPyWellGeoLateral').BottomholeTarget = {
      id: 'b',
      label: 'B',
      x: 0,
      y: 0,
      z: -100,
      wellIndex: 2,
      source: 'pad',
    };
    const external: import('./padClusteringPyWellGeoLateral').BottomholeTarget = {
      id: 'c',
      label: 'C',
      x: 0,
      y: 0,
      z: -100,
      wellIndex: null,
      source: 'project',
    };
    expect(bottomholeTargetMarkerColor(padTargetSame, 0)).toBe('blue');
    expect(bottomholeTargetMarkerColor(padTargetOther, 0)).toBe('amber');
    expect(bottomholeTargetMarkerColor(external, 0)).toBe('red');
  });

  it('lists external bottomhole targets without auto well index', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('ext-bh', 'well_bottomhole_nnb', 37.631, 55.751, {
        [WELL_BOTTOMHOLE_TVD_M]: 2100,
      }),
    ];
    const external = bottomholeTargetsExternal(infra, padId, 37.62, 55.74);
    expect(external).toHaveLength(1);
    expect(external[0]!.wellIndex).toBeNull();
    expect(external[0]!.linkedPadId).toBeNull();
  });

  it('buildBottomholeSelectOptions prioritizes lateral targets for well', () => {
    const padId = 'pad-1';
    const infra = [
      bottomhole('main-1', 'well_bottomhole_nnb', 37.621, 55.741, {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_ROLE]: 'main',
      }),
      bottomhole('lat-1', 'well_bottomhole_nnb', 37.622, 55.742, {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-1',
      }),
    ];
    const { padTargets, externalTargets } = buildBottomholeTargetCatalog(infra, padId, 37.62, 55.74);
    const linked = bottomholesLinkedToPad(infra, padId);
    const laterals = lateralBottomholeTargetsForWell(linked, 0, 37.62, 55.74);
    expect(laterals.some((t) => t.isLateral && t.id === 'lat-1')).toBe(true);
    const opts = buildBottomholeSelectOptions(padTargets, externalTargets, 0);
    expect(opts.some((o) => o.label === 'Доп.стволы этой скважины')).toBe(true);
    expect(opts.some((o) => o.value === 'lat-1')).toBe(true);
  });
});
