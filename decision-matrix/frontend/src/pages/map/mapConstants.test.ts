import { describe, expect, it } from 'vitest';
import { MOVE_MATCH_EPS, THRESHOLD_META } from './mapConstants';

describe('mapConstants', () => {
  it('exports threshold meta for POI subtypes', () => {
    expect(THRESHOLD_META.length).toBeGreaterThan(0);
    expect(THRESHOLD_META.find((m) => m.subtype === 'gtes')?.defaultKm).toBe(60);
  });

  it('exports move match epsilon', () => {
    expect(MOVE_MATCH_EPS).toBeGreaterThan(0);
  });
});
