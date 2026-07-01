import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import {
  buildMap3dInfraBottomholeInstances,
  infraBottomholeDedupeKeys,
} from '../map3dInfraBottomholeInstances';
import { buildMap3dWellTrajectoryLayerData } from '../map3dWellTrajectoryInstances';
import { WELL_BOTTOMHOLE_LINKED_PAD_ID, WELL_BOTTOMHOLE_TVD_M } from '../../wellBottomholeProperties';

const pad: InfraObject = {
  id: 'pad-1',
  name: 'Куст-1',
  subtype: 'oil_pad',
  lon: 37.62,
  lat: 55.76,
  properties: {
    pad_reference_elevation_m: 150,
    pad_height_m: 2,
  },
};

describe('buildMap3dInfraBottomholeInstances', () => {
  it('places NNB bottomhole at KB − TVD', () => {
    const bh: InfraObject = {
      id: 'bh-1',
      name: 'Забой-1',
      subtype: 'well_bottomhole_nnb',
      lon: 37.621,
      lat: 55.761,
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'pad-1',
        [WELL_BOTTOMHOLE_TVD_M]: 1500,
        well_bottomhole_well_index: 0,
      },
    };
    const { bottomholes } = buildMap3dInfraBottomholeInstances([bh], [pad, bh]);
    expect(bottomholes).toHaveLength(1);
    expect(bottomholes[0]).toMatchObject({
      lon: 37.621,
      lat: 55.761,
      altM: 152 - 1500,
      radiusM: 4,
    });
  });

  it('places GS line heel and toe at separate depths', () => {
    const gs: InfraObject = {
      id: 'gs-1',
      name: 'ГС-1',
      subtype: 'well_bottomhole_gs',
      lon: 37.62,
      lat: 55.76,
      end_lon: 37.625,
      end_lat: 55.765,
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'pad-1',
        well_bottomhole_heel_tvd_m: 1400,
        well_bottomhole_toe_tvd_m: 1500,
        well_bottomhole_well_index: 1,
      },
    };
    const { bottomholes, gsLines } = buildMap3dInfraBottomholeInstances([gs], [pad, gs]);
    expect(bottomholes).toHaveLength(2);
    expect(bottomholes[0]?.altM).toBe(152 - 1400);
    expect(bottomholes[1]?.altM).toBe(152 - 1500);
    expect(gsLines[0]?.alts).toEqual([152 - 1400, 152 - 1500]);
  });
});

describe('buildMap3dWellTrajectoryLayerData with infra', () => {
  it('prefers infra bottomhole over duplicate GeoJSON target', () => {
    const bh: InfraObject = {
      id: 'bh-1',
      name: 'Забой-1',
      subtype: 'well_bottomhole_nnb',
      lon: 37.621,
      lat: 55.761,
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'pad-1',
        [WELL_BOTTOMHOLE_TVD_M]: 1500,
        well_bottomhole_well_index: 0,
      },
    };
    const data = buildMap3dWellTrajectoryLayerData(
      [
        {
          type: 'Feature',
          properties: {
            kind: 'bottomhole_target_3d',
            well_index: 0,
            infra_object_id: 'pad-1',
          },
          geometry: { type: 'Point', coordinates: [37.621, 55.761, -999] },
        },
      ],
      { includeTrajectories: false, includePlanLines: false, infraObjects: [bh], infraPool: [pad, bh] },
    );
    expect(data.bottomholes).toHaveLength(1);
    expect(data.bottomholes[0]?.altM).toBe(152 - 1500);
    expect(infraBottomholeDedupeKeys([bh])).toEqual(new Set(['pad-1:0']));
  });
});
