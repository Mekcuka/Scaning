import { describe, expect, it } from 'vitest';
import { mergeInfraPropertiesForSave } from './mergeInfraPropertiesForSave';
import { PAD_HEIGHT_M, PAD_LENGTH_M, PAD_REFERENCE_ELEVATION_M, PAD_WIDTH_M } from './infraPadEarthwork';

describe('mergeInfraPropertiesForSave', () => {
  it('does not set throughput for excluded subtypes', () => {
    const props = mergeInfraPropertiesForSave('node', {});
    expect(props.throughput_capacity_annual).toBeUndefined();
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
