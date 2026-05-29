import { describe, expect, it } from 'vitest';
import { ALL_MAP_SUBTYPES, LAYER_VISIBILITY_GROUPS } from './api';

describe('LAYER_VISIBILITY_GROUPS', () => {
  it('covers every map subtype exactly once', () => {
    const covered = LAYER_VISIBILITY_GROUPS.flatMap((g) => g.subtypes);
    const seen = new Set<string>();
    for (const st of covered) {
      expect(seen.has(st)).toBe(false);
      seen.add(st);
    }
    for (const st of ALL_MAP_SUBTYPES) {
      expect(seen.has(st)).toBe(true);
    }
    expect(seen.size).toBe(ALL_MAP_SUBTYPES.length);
  });
});
