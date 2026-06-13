import { describe, expect, it } from 'vitest';
import { mergeInfraPropertiesForSave } from './mergeInfraPropertiesForSave';
import { PAD_HEIGHT_M, PAD_LENGTH_M, PAD_REFERENCE_ELEVATION_M, PAD_WIDTH_M } from './infraPadEarthwork';

describe('mergeInfraPropertiesForSave', () => {
  it('does not set throughput for excluded subtypes', () => {
    const props = mergeInfraPropertiesForSave('node', {});
    expect(props.throughput_capacity_annual).toBeUndefined();
  });

  it('does not set throughput for well bottomhole subtypes', () => {
    for (const subtype of [
      'well_bottomhole_nnb',
      'well_bottomhole_gs_heel',
      'well_bottomhole_gs_toe',
    ]) {
      const props = mergeInfraPropertiesForSave(subtype, {});
      expect(props.throughput_capacity_annual).toBeUndefined();
    }
  });

  it('does not set sand volume keys for well bottomhole subtypes', () => {
    for (const subtype of [
      'well_bottomhole_nnb',
      'well_bottomhole_gs_heel',
      'well_bottomhole_gs_toe',
    ]) {
      const props = mergeInfraPropertiesForSave(subtype, {
        sand_volume_m3: 1000,
        sand_volume_mode: 'single',
        well_bottomhole_tvd_m: 1500,
      });
      expect(props.sand_volume_m3).toBeUndefined();
      expect(props.sand_volume_mode).toBeUndefined();
      expect(props.well_bottomhole_tvd_m).toBe(1500);
    }
  });

  it('sets default pad length and width for earthwork-eligible subtypes', () => {
    const props = mergeInfraPropertiesForSave('substation', {});
    expect(props[PAD_LENGTH_M]).toBe(120);
    expect(props[PAD_WIDTH_M]).toBe(80);
    expect(props[PAD_HEIGHT_M]).toBe(1);
    expect(props[PAD_REFERENCE_ELEVATION_M]).toBe(0);
  });

  it('does not override existing pad dimensions', () => {
    const props = mergeInfraPropertiesForSave('oil_pad', { [PAD_LENGTH_M]: 200, [PAD_WIDTH_M]: 100 });
    expect(props[PAD_LENGTH_M]).toBe(200);
    expect(props[PAD_WIDTH_M]).toBe(100);
  });

  it('sets default pad length and width for sand quarry', () => {
    const props = mergeInfraPropertiesForSave('sand_quarry', {});
    expect(props[PAD_LENGTH_M]).toBe(120);
    expect(props[PAD_WIDTH_M]).toBe(80);
  });

  it('does not set pad dimensions for node', () => {
    const props = mergeInfraPropertiesForSave('node', {});
    expect(props[PAD_LENGTH_M]).toBeUndefined();
    expect(props[PAD_WIDTH_M]).toBeUndefined();
  });
});
