import { describe, expect, it } from 'vitest';
import {
  expandMapBbox,
  mergeInfraForMapDisplay,
  shouldUpdateMapBbox,
  viewportInsideFetchedBuffer,
} from './mapBboxUtils';

describe('expandMapBbox', () => {
  it('expands envelope by buffer ratio', () => {
    const out = expandMapBbox('0,0,10,10', 0.1);
    expect(out).toBe('-1,-1,11,11');
  });
});

describe('viewportInsideFetchedBuffer', () => {
  const base = '0,0,10,10';

  it('accepts a small pan inside the 12% buffer', () => {
    expect(viewportInsideFetchedBuffer(base, '0.5,0.5,9.5,9.5')).toBe(true);
    expect(shouldUpdateMapBbox(base, '0.5,0.5,9.5,9.5')).toBe(false);
  });

  it('requires a new fetch when the viewport leaves the buffered envelope', () => {
    expect(viewportInsideFetchedBuffer(base, '8,8,18,18')).toBe(false);
    expect(shouldUpdateMapBbox(base, '8,8,18,18')).toBe(true);
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

  it('shows overlay ids from full when absent from viewport slice', () => {
    const full = [
      { id: 'a', name: 'A' },
      { id: 'new', name: 'N' },
    ];
    const viewport = [{ id: 'a', name: 'A' }];
    const merged = mergeInfraForMapDisplay(viewport, full, [], ['new']);
    expect(merged.map((o) => o.id).sort()).toEqual(['a', 'new']);
  });

  it('prefers full row over stale viewport row', () => {
    const full = [{ id: 'a', name: 'Fresh' }];
    const viewport = [{ id: 'a', name: 'Stale' }];
    const merged = mergeInfraForMapDisplay(viewport, full, []);
    expect(merged[0]?.name).toBe('Fresh');
  });
});
