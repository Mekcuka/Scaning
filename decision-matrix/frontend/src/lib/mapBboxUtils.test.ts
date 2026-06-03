import { describe, expect, it } from 'vitest';
import { expandMapBbox, mergeInfraForMapDisplay } from './mapBboxUtils';

describe('expandMapBbox', () => {
  it('expands envelope by buffer ratio', () => {
    const out = expandMapBbox('0,0,10,10', 0.1);
    expect(out).toBe('-1,-1,11,11');
  });
});

describe('mergeInfraForMapDisplay', () => {
  it('keeps selected ids from full cache', () => {
    const full = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const viewport = [{ id: 'a', name: 'A' }];
    const merged = mergeInfraForMapDisplay(viewport, full, ['c']);
    expect(merged.map((o) => o.id).sort()).toEqual(['a', 'c']);
  });
});
