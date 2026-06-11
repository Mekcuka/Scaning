import { describe, expect, it } from 'vitest';
import {
  envelopeFromObject,
  hasSavedPadSketch,
  isPadSubtype,
  padParamsFromObject,
  PAD_FILL_VOLUME_M3,
} from './infraPadEarthwork';

describe('infraPadEarthwork', () => {
  it('detects pad subtypes', () => {
    expect(isPadSubtype('oil_pad')).toBe(true);
    expect(isPadSubtype('gas_pad')).toBe(true);
    expect(isPadSubtype('node')).toBe(false);
  });

  it('reads pad params from properties', () => {
    const draft = padParamsFromObject({
      properties: {
        pad_length_m: 120,
        pad_width_m: 80,
        pad_height_m: 2.5,
        [PAD_FILL_VOLUME_M3]: 24000,
      },
    });
    expect(draft.lengthM).toBe('120');
    expect(draft.widthM).toBe('80');
    expect(draft.heightM).toBe('2.5');
  });

  it('reads envelope from properties', () => {
    expect(envelopeFromObject({ pad_envelope_enabled: true, pad_envelope_wrap_width_m: 4 })).toEqual({
      enabled: true,
      wrap_width_m: 4,
    });
    expect(envelopeFromObject({ pad_envelope_enabled: false, pad_envelope_wrap_width_m: 2 })).toEqual({
      enabled: false,
      wrap_width_m: 2,
    });
  });

  it('detects saved sketch json', () => {
    expect(hasSavedPadSketch({ pad_earthwork_sketch_json: { kind: 'plan_rectangle' } })).toBe(true);
    expect(hasSavedPadSketch({})).toBe(false);
  });
});
