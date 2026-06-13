import { describe, expect, it } from 'vitest';
import { buildPadClusteringSaveProperties, filterPadObjects, isPadLayoutDraftDirty } from '../lib/padClusteringSave';
import type { InfraObject } from './api';

function samplePad(overrides: Partial<InfraObject> = {}): InfraObject {
  return {
    id: 'pad-1',
    project_id: 'proj-1',
    name: 'Куст 1',
    subtype: 'oil_pad',
    lon: 50,
    lat: 55,
    layer_id: 'layer-1',
    properties: {},
    ...overrides,
  } as InfraObject;
}

describe('filterPadObjects', () => {
  it('keeps oil_pad and gas_pad only', () => {
    const objects = [
      samplePad({ id: '1', subtype: 'oil_pad' }),
      samplePad({ id: '2', subtype: 'gas_pad' }),
      samplePad({ id: '3', subtype: 'node' }),
    ];
    expect(filterPadObjects(objects).map((o) => o.id)).toEqual(['1', '2']);
  });
});

describe('buildPadClusteringSaveProperties', () => {
  it('merges well layout and pad dimensions', () => {
    const props = buildPadClusteringSaveProperties(
      { pad_well_count: 6 },
      {
        padWellCount: '12',
        padWellsPerGroup: '2',
        padWellSpacingM: '9',
        padGroupSpacingM: '12',
        padMarginLeftM: '27',
        padMarginBottomM: '43',
        padMarginTopM: '15',
        padMarginEndM: '70',
        lengthM: '100',
        widthM: '60',
        heightM: '1.5',
        rotationDeg: '90',
        referenceElevationM: '120',
      },
    );
    expect(props).toMatchObject({
      pad_well_count: 12,
      pad_wells_per_group: 2,
      pad_length_m: 100,
      pad_width_m: 60,
      pad_height_m: 1.5,
      pad_reference_elevation_m: 120,
      pad_rotation_deg: 90,
    });
  });

  it('returns null when reference elevation invalid', () => {
    const props = buildPadClusteringSaveProperties({}, {
      padWellCount: '12',
      padWellsPerGroup: '1',
      padWellSpacingM: '9',
      padGroupSpacingM: '9',
      padMarginLeftM: '27',
      padMarginBottomM: '43',
      padMarginTopM: '15',
      padMarginEndM: '70',
      lengthM: '120',
      widthM: '80',
      heightM: '1',
      rotationDeg: '90',
      referenceElevationM: 'not-a-number',
    });
    expect(props).toBeNull();
  });
});

describe('isPadLayoutDraftDirty', () => {
  const base = {
    padWellCount: '12',
    padWellsPerGroup: '1',
    padWellSpacingM: '9',
    padGroupSpacingM: '9',
    padMarginLeftM: '27',
    padMarginBottomM: '43',
    padMarginTopM: '15',
    padMarginEndM: '70',
    lengthM: '196',
    widthM: '58',
    heightM: '1',
    rotationDeg: '90',
    referenceElevationM: '120',
  };

  it('detects NDS change only', () => {
    expect(isPadLayoutDraftDirty({ ...base, rotationDeg: '180' }, base)).toBe(true);
    expect(isPadLayoutDraftDirty({ ...base, heightM: '2' }, base)).toBe(false);
  });
});
