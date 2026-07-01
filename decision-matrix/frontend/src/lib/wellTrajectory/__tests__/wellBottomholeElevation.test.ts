import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import {
  elevationFromTvd,
  gsBottomhole3dLengthMeters,
  readGsLineBottomholeElevations,
  readPadKbM,
  readPointBottomholeElevation,
  tvdFromElevation,
} from '../wellBottomholeElevation';
import {
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_TVD_M,
} from '../../wellBottomholeProperties';

function pad(ref = 100, height = 2): InfraObject {
  return {
    id: 'pad-1',
    layer_id: 'l1',
    name: 'Pad',
    subtype: 'oil_pad',
    category: 'pad',
    lon: 37.6,
    lat: 55.7,
    properties: {
      pad_reference_elevation_m: ref,
      pad_height_m: height,
    },
  };
}

describe('wellBottomholeElevation', () => {
  it('computes KB from pad', () => {
    expect(readPadKbM(pad(100, 2))).toBe(102);
    expect(readPadKbM(null)).toBe(1);
  });

  it('converts TVD and elevation', () => {
    expect(elevationFromTvd(102, 1500)).toBe(-1398);
    expect(tvdFromElevation(102, -1398)).toBe(1500);
  });

  it('reads point bottomhole elevation from TVD', () => {
    const bh: InfraObject = {
      id: 'bh-1',
      layer_id: 'l1',
      name: 'NNB',
      subtype: 'well_bottomhole_nnb',
      category: 'well',
      lon: 37.61,
      lat: 55.71,
      properties: { [WELL_BOTTOMHOLE_TVD_M]: 1500 },
    };
    expect(readPointBottomholeElevation(bh, pad())).toBe(-1398);
  });

  it('reads separate GS heel/toe elevations', () => {
    const gs: InfraObject = {
      id: 'gs-1',
      layer_id: 'l1',
      name: 'GS',
      subtype: 'well_bottomhole_gs',
      category: 'well',
      lon: 37.61,
      lat: 55.71,
      end_lon: 37.62,
      end_lat: 55.71,
      properties: {
        [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400,
        [WELL_BOTTOMHOLE_TOE_TVD_M]: 1500,
      },
    };
    const { heelZ, toeZ } = readGsLineBottomholeElevations(gs, pad());
    expect(heelZ).toBe(-1298);
    expect(toeZ).toBe(-1398);
  });

  it('computes 3D GS length from plan length and Z delta', () => {
    expect(gsBottomhole3dLengthMeters(62, 0, 0)).toBe(62);
    expect(gsBottomhole3dLengthMeters(62, -1298, -1398)).toBeCloseTo(
      Math.sqrt(62 * 62 + 100 * 100),
      6,
    );
  });
});
