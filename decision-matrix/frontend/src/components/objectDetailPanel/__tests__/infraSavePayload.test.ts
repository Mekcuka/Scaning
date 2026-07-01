import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../../lib/api';
import {
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_TOE_TVD_M,
} from '../../../lib/wellBottomholeProperties';
import { PAD_REFERENCE_ELEVATION_M } from '../../../lib/infraPadEarthwork';
import { LINE_ELEVATION_PROFILE_STEP_M } from '../../../lib/lineElevationProfile';
import { buildInfraSavePayload, type InfraSaveDraft } from '../infraSavePayload';
import { EMPTY_BOTTOMHOLE_FORM_FIELDS } from '../bottomholeFormFields';

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
    render3dDiameter: '',
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
    lineProfileStepM: '',
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

  it('persists render_3d_scale from the form', () => {
    const obj: InfraObject = {
      id: 'n-1',
      layer_id: 'layer-1',
      name: 'Узел',
      subtype: 'node',
      category: 'node',
      lon: 37.61,
      lat: 55.71,
      properties: { render_3d_scale: 10 },
    };
    const payload = buildInfraSavePayload(
      baseDraft({ subtype: 'node', name: 'Узел', render3dScale: '3' }),
      obj,
    );
    expect((payload.properties as Record<string, unknown>).render_3d_scale).toBe(3);
  });

  it('persists render_3d_diameter_m for tube lines', () => {
    const obj: InfraObject = {
      id: 'l-1',
      layer_id: 'layer-1',
      name: 'Дорога',
      subtype: 'autoroad',
      category: 'line',
      lon: 37.61,
      lat: 55.71,
      end_lon: 37.62,
      end_lat: 55.71,
      properties: {},
    };
    const payload = buildInfraSavePayload(
      baseDraft({
        subtype: 'autoroad',
        name: 'Дорога',
        render3dDiameter: '6',
        render3dHeight: '',
      }),
      obj,
    );
    const props = payload.properties as Record<string, unknown>;
    expect(props.render_3d_diameter_m).toBe(6);
    expect(props.render_3d_height_m).toBeUndefined();
  });

  it('writes default scale explicitly instead of omitting the key', () => {
    const obj: InfraObject = {
      id: 'n-2',
      layer_id: 'layer-1',
      name: 'Узел',
      subtype: 'node',
      category: 'node',
      lon: 37.61,
      lat: 55.71,
      properties: { render_3d_scale: 10 },
    };
    const payload = buildInfraSavePayload(
      baseDraft({ subtype: 'node', name: 'Узел', render3dScale: '1' }),
      obj,
    );
    expect((payload.properties as Record<string, unknown>).render_3d_scale).toBe(1);
  });

  it('keeps pad_reference_elevation_m from the object passed into the payload', () => {
    const obj: InfraObject = {
      id: 'pad-1',
      layer_id: 'layer-1',
      name: 'Куст',
      subtype: 'oil_pad',
      category: 'pad',
      lon: 37.61,
      lat: 55.71,
      properties: { [PAD_REFERENCE_ELEVATION_M]: 135.14 },
    };
    const payload = buildInfraSavePayload(
      baseDraft({
        subtype: 'oil_pad',
        name: 'Куст',
        bottomholeFields: EMPTY_BOTTOMHOLE_FORM_FIELDS,
      }),
      obj,
    );
    const props = payload.properties as Record<string, unknown>;
    expect(props[PAD_REFERENCE_ELEVATION_M]).toBe(135.14);
  });

  it('persists line_elevation_profile_step_m for eligible line subtypes', () => {
    const obj: InfraObject = {
      id: 'l-2',
      layer_id: 'layer-1',
      name: 'Дорога',
      subtype: 'autoroad',
      category: 'line',
      lon: 37.61,
      lat: 55.71,
      end_lon: 37.62,
      end_lat: 55.71,
      properties: { [LINE_ELEVATION_PROFILE_STEP_M]: 100 },
    };
    const payload = buildInfraSavePayload(
      baseDraft({
        subtype: 'autoroad',
        name: 'Дорога',
        lineProfileStepM: '50',
        bottomholeFields: EMPTY_BOTTOMHOLE_FORM_FIELDS,
      }),
      obj,
    );
    const props = payload.properties as Record<string, unknown>;
    expect(props[LINE_ELEVATION_PROFILE_STEP_M]).toBe(50);
  });

  it('clamps line_elevation_profile_step_m to allowed range on save', () => {
    const obj: InfraObject = {
      id: 'l-3',
      layer_id: 'layer-1',
      name: 'Дорога',
      subtype: 'autoroad',
      category: 'line',
      lon: 37.61,
      lat: 55.71,
      end_lon: 37.62,
      end_lat: 55.71,
      properties: {},
    };
    const payload = buildInfraSavePayload(
      baseDraft({
        subtype: 'autoroad',
        name: 'Дорога',
        lineProfileStepM: '5',
        bottomholeFields: EMPTY_BOTTOMHOLE_FORM_FIELDS,
      }),
      obj,
    );
    const props = payload.properties as Record<string, unknown>;
    expect(props[LINE_ELEVATION_PROFILE_STEP_M]).toBe(10);
  });
});
