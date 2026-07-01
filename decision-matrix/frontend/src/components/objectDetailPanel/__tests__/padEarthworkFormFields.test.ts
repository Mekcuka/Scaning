import { describe, expect, it } from 'vitest';
import {
  normalizePadEarthworkField,
  padEarthworkFormFieldsEqual,
} from '../padEarthworkFormFields';

describe('padEarthworkFormFields', () => {
  it('normalizes decimal comma and trims', () => {
    expect(normalizePadEarthworkField(' 135,14 ')).toBe('135.14');
  });

  it('detects dirty when reference elevation changes', () => {
    const baseline = {
      lengthM: '120',
      widthM: '80',
      heightM: '1',
      rotationDeg: '90',
      referenceElevationM: '135.14',
    };
    const edited = { ...baseline, referenceElevationM: '140' };
    expect(padEarthworkFormFieldsEqual(baseline, edited)).toBe(false);
  });

  it('treats comma and dot as equal', () => {
    const a = {
      lengthM: '120',
      widthM: '80',
      heightM: '1',
      rotationDeg: '90',
      referenceElevationM: '135.14',
    };
    const b = { ...a, referenceElevationM: '135,14' };
    expect(padEarthworkFormFieldsEqual(a, b)).toBe(true);
  });
});
