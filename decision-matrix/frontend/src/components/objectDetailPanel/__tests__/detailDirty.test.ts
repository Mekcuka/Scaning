import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../../lib/api';
import { LINE_ELEVATION_PROFILE_STEP_M } from '../../../lib/lineElevationProfile';
import {
  computeInfraIsDirty,
  computeInfraTabDirty,
  type InfraDirtyDraft,
} from '../detailDirty';
import { createInfraFormDraftFromObject } from '../formState';
import { EMPTY_BOTTOMHOLE_FORM_FIELDS } from '../bottomholeFormFields';

function lineObject(
  props: Record<string, unknown> = {},
): InfraObject {
  return {
    id: 'line-1',
    layer_id: 'layer-1',
    name: 'Дорога',
    subtype: 'autoroad',
    category: 'line',
    lon: 37.61,
    lat: 55.71,
    end_lon: 37.62,
    end_lat: 55.71,
    properties: props,
  };
}

function baseDraft(obj: InfraObject, overrides: Partial<InfraDirtyDraft> = {}): InfraDirtyDraft {
  const draft = createInfraFormDraftFromObject(obj, [], []);
  return {
    name: draft.name,
    description: draft.description,
    subtype: draft.subtype,
    layerId: draft.layerId,
    lon: draft.lon,
    lat: draft.lat,
    endLon: draft.endLon,
    endLat: draft.endLat,
    sandInitialM3: draft.sandInitialM3,
    sandCurrentM3: draft.sandCurrentM3,
    sandDemandM3: draft.sandDemandM3,
    sandVolumeByYear: draft.sandVolumeByYear,
    sandVolumeMode: draft.sandVolumeMode,
    entryDate: draft.entryDate,
    capacityValue: draft.capacityValue,
    render3dHeight: draft.render3dHeight,
    render3dDiameter: draft.render3dDiameter,
    render3dBase: draft.render3dBase,
    render3dScale: draft.render3dScale,
    render3dVisible: draft.render3dVisible,
    render3dStyle: draft.render3dStyle,
    render3dModelId: draft.render3dModelId,
    padWellCount: draft.padWellCount,
    padWellsPerGroup: draft.padWellsPerGroup,
    padWellSpacingM: draft.padWellSpacingM,
    padGroupSpacingM: draft.padGroupSpacingM,
    padMarginLeftM: draft.padMarginLeftM,
    padMarginBottomM: draft.padMarginBottomM,
    padMarginTopM: draft.padMarginTopM,
    padMarginEndM: draft.padMarginEndM,
    pointFootprintLineConnections: draft.pointFootprintLineConnections,
    bottomholeFields: EMPTY_BOTTOMHOLE_FORM_FIELDS,
    lineProfileStepM: draft.lineProfileStepM,
    ...overrides,
  };
}

describe('detailDirty line profile step', () => {
  it('marks infra dirty when profile step changes', () => {
    const obj = lineObject({ [LINE_ELEVATION_PROFILE_STEP_M]: 100 });
    const draft = baseDraft(obj, { lineProfileStepM: '50' });
    expect(computeInfraIsDirty(obj, draft, [], true)).toBe(true);
    expect(computeInfraTabDirty('profile', obj, draft, [], true)).toBe(true);
  });

  it('is clean when profile step matches stored value', () => {
    const obj = lineObject({ [LINE_ELEVATION_PROFILE_STEP_M]: 100 });
    const draft = baseDraft(obj, { lineProfileStepM: '100' });
    expect(computeInfraTabDirty('profile', obj, draft, [], true)).toBe(false);
  });

  it('clamps out-of-range draft before comparing dirty state', () => {
    const obj = lineObject({ [LINE_ELEVATION_PROFILE_STEP_M]: 1000 });
    const draft = baseDraft(obj, { lineProfileStepM: '1500' });
    expect(computeInfraTabDirty('profile', obj, draft, [], true)).toBe(false);
  });
});
