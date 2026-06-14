import { describe, expect, it } from 'vitest';
import {
  envelopeFromObject,
  envelopeWrapForApi,
  hasSavedPadSketch,
  isEarthworkEligibleSubtype,
  isPadSubtype,
  mergePadEarthworkParam,
  padParamDisplayValue,
  parsePadParamCommit,
  padParamsFromObject,
  PAD_FILL_VOLUME_M3,
  PAD_LENGTH_M,
} from './infraPadEarthwork';
import { makeInfraPoint } from '../test/fixtures/infra';

describe('infraPadEarthwork', () => {
  it('detects pad subtypes', () => {
    expect(isPadSubtype('oil_pad')).toBe(true);
    expect(isPadSubtype('gas_pad')).toBe(true);
    expect(isPadSubtype('node')).toBe(false);
  });

  it('detects earthwork-eligible point subtypes', () => {
    expect(isEarthworkEligibleSubtype('substation')).toBe(true);
    expect(isEarthworkEligibleSubtype('gas_processing')).toBe(true);
    expect(isEarthworkEligibleSubtype('oil_pad')).toBe(true);
    expect(isEarthworkEligibleSubtype('node')).toBe(false);
    expect(isEarthworkEligibleSubtype('well_bottomhole_nnb')).toBe(false);
    expect(isEarthworkEligibleSubtype('well_bottomhole_gs_heel')).toBe(false);
    expect(isEarthworkEligibleSubtype('well_bottomhole_gs_toe')).toBe(false);
    expect(isEarthworkEligibleSubtype('sand_quarry')).toBe(true);
    expect(isEarthworkEligibleSubtype('autoroad')).toBe(false);
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

  it('uses default length and width when properties missing', () => {
    const draft = padParamsFromObject({ properties: {} });
    expect(draft.lengthM).toBe('120');
    expect(draft.widthM).toBe('80');
    expect(draft.heightM).toBe('1');
    expect(draft.referenceElevationM).toBe('0');
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
    expect(envelopeFromObject({ pad_envelope_enabled: false, pad_envelope_wrap_width_m: 0 })).toEqual({
      enabled: false,
      wrap_width_m: 3,
    });
  });

  it('builds envelope payload for API with positive wrap width', () => {
    expect(envelopeWrapForApi(false, 0)).toEqual({ enabled: false, wrap_width_m: 3 });
    expect(envelopeWrapForApi(true, 5)).toEqual({ enabled: true, wrap_width_m: 5 });
  });

  it('detects saved sketch json', () => {
    expect(hasSavedPadSketch({ pad_earthwork_sketch_json: { kind: 'plan_rectangle' } })).toBe(true);
    expect(hasSavedPadSketch({})).toBe(false);
  });

  it('mergePadEarthworkParam updates and clears keys', () => {
    const merged = mergePadEarthworkParam({}, 'length_m', 100);
    expect(merged[PAD_LENGTH_M]).toBe(100);
    const cleared = mergePadEarthworkParam(merged, 'length_m', null);
    expect(cleared[PAD_LENGTH_M]).toBeUndefined();
  });

  it('parsePadParamCommit validates positive dimensions', () => {
    expect(parsePadParamCommit('length_m', 50)).toBe(50);
    expect(parsePadParamCommit('length_m', 0)).toBeUndefined();
    expect(parsePadParamCommit('length_m', '')).toBe(null);
    expect(parsePadParamCommit('rotation_deg', 400)).toBe(360);
  });

  it('padParamDisplayValue reads from object', () => {
    const obj = makeInfraPoint({
      properties: { pad_length_m: 80, pad_rotation_deg: 90 },
    });
    expect(padParamDisplayValue(obj, 'length_m')).toBe(80);
    expect(padParamDisplayValue(obj, 'rotation_deg')).toBe(90);
  });

  it('padParamDisplayValue uses default length and width', () => {
    const obj = makeInfraPoint({ properties: {} });
    expect(padParamDisplayValue(obj, 'length_m')).toBe(120);
    expect(padParamDisplayValue(obj, 'width_m')).toBe(80);
    expect(padParamDisplayValue(obj, 'height_m')).toBe(1);
    expect(padParamDisplayValue(obj, 'reference_elevation_m')).toBe(0);
  });
});
