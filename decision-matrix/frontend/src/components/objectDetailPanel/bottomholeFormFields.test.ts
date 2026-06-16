import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../lib/api';
import {
  bottomholeFormFieldsDirty,
  bottomholeFormFieldsFromInfraObject,
  bottomholeFormFieldsToProperties,
  mergeBottomholeFormFields,
} from './bottomholeFormFields';
import {
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TOE_TVD_M,
} from '../../lib/wellBottomholeProperties';

function gsObject(props: Record<string, unknown> = {}): InfraObject {
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
    properties: props,
  };
}

describe('bottomholeFormFields', () => {
  it('round-trips GS TVD fields to properties', () => {
    const obj = gsObject({
      [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400,
      [WELL_BOTTOMHOLE_TOE_TVD_M]: 1500,
      [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'pad-1',
    });
    const fields = bottomholeFormFieldsFromInfraObject(obj);
    expect(fields.heelTvdM).toBe('1400');
    expect(fields.toeTvdM).toBe('1500');
    expect(fields.linkedPadId).toBe('pad-1');

    const props = bottomholeFormFieldsToProperties({
      ...fields,
      heelTvdM: '1300',
      toeTvdM: '1600',
    });
    expect(props[WELL_BOTTOMHOLE_HEEL_TVD_M]).toBe(1300);
    expect(props[WELL_BOTTOMHOLE_TOE_TVD_M]).toBe(1600);
  });

  it('detects dirty bottomhole fields', () => {
    const obj = gsObject({ [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400 });
    const fields = bottomholeFormFieldsFromInfraObject(obj);
    expect(bottomholeFormFieldsDirty(obj.properties, fields)).toBe(false);
    expect(
      bottomholeFormFieldsDirty(obj.properties, mergeBottomholeFormFields(fields, { heelTvdM: '1500' })),
    ).toBe(true);
  });
});
