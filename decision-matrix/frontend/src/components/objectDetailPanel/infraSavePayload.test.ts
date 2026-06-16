import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../lib/api';
import {
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
} from '../../lib/wellBottomholeProperties';
import { buildInfraSavePayload, type InfraSaveDraft } from './infraSavePayload';
import { EMPTY_BOTTOMHOLE_FORM_FIELDS } from './bottomholeFormFields';

function gsObject(): InfraObject {
  return {
    id: 'gs-1',
    layer_id: 'layer-1',
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
}

function baseDraft(overrides: Partial<InfraSaveDraft> = {}): InfraSaveDraft {
  return {
    name: 'GS',
    description: '',
    subtype: 'well_bottomhole_gs',
    layerId: 'layer-1',
    lon: '37.611',
    lat: '55.711',
    endLon: '37.621',
    endLat: '55.712',
    sandInitialM3: '',
    sandCurrentM3: '',
    sandDemandM3: '',
    sandVolumeByYear: {},
    sandVolumeMode: 'single',
    entryDate: '',
    capacityValue: '',
    render3dHeight: '0',
    render3dBase: '0',
    render3dScale: '1',
    render3dVisible: true,
    render3dStyle: '',
    render3dModelId: '',
    padWellCount: '',
    padWellsPerGroup: '',
    padWellSpacingM: '',
    padGroupSpacingM: '',
    padMarginLeftM: '',
    padMarginBottomM: '',
    padMarginTopM: '',
    padMarginEndM: '',
    pointFootprintLineConnections: {},
    bottomholeFields: {
      ...EMPTY_BOTTOMHOLE_FORM_FIELDS,
      heelTvdM: '1300',
      toeTvdM: '1600',
    },
    ...overrides,
  };
}

describe('buildInfraSavePayload', () => {
  it('persists GS line endpoints and dual TVD properties', () => {
    const payload = buildInfraSavePayload(baseDraft(), gsObject());
    expect(payload.lon).toBeCloseTo(37.611, 3);
    expect(payload.lat).toBeCloseTo(55.711, 3);
    expect(payload.end_lon).toBeCloseTo(37.621, 3);
    expect(payload.end_lat).toBeCloseTo(55.712, 3);
    expect(payload.coordinates).toEqual([
      [expect.closeTo(37.611, 3), expect.closeTo(55.711, 3)],
      [expect.closeTo(37.621, 3), expect.closeTo(55.712, 3)],
    ]);
    const props = payload.properties as Record<string, unknown>;
    expect(props[WELL_BOTTOMHOLE_HEEL_TVD_M]).toBe(1300);
    expect(props[WELL_BOTTOMHOLE_TOE_TVD_M]).toBe(1600);
  });
});
