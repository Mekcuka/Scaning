import { describe, expect, it } from 'vitest';
import { coordForSave, formatCoord, parseCoord, roundCoord } from './coords';

describe('coords', () => {
  it('formatCoord shows 3 decimals', () => {
    expect(formatCoord(61.103847)).toBe('61.104');
  });

  it('parseCoord keeps full precision', () => {
    expect(parseCoord('61.103847291')).toBeCloseTo(61.103847291, 9);
  });

  it('coordForSave keeps original when display unchanged', () => {
    const original = 61.103847291;
    expect(coordForSave(parseCoord('61.104'), original, formatCoord(original))).toBe(original);
  });

  it('coordForSave uses parsed when user edited', () => {
    expect(coordForSave(parseCoord('61.105'), 61.103847, '61.105')).toBe(61.105);
  });

  it('roundCoord is for display math only', () => {
    expect(roundCoord(61.103847)).toBe(61.104);
  });
});
