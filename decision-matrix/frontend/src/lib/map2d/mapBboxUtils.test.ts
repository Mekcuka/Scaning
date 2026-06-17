import { describe, expect, it } from 'vitest';
import {
  expandMapBbox,
  mergeInfraForMapDisplay,
  MAP_VIEWPORT_MIN_OBJECTS,
  shouldUpdateMapBbox,
  shouldUseViewportInfraLoad,
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

  it('accepts a small pan inside the buffer', () => {
    expect(viewportInsideFetchedBuffer(base, '0.5,0.5,9.5,9.5')).toBe(true);
    expect(shouldUpdateMapBbox(base, '0.5,0.5,9.5,9.5')).toBe(false);
  });

  it('requires a new fetch when the viewport leaves the buffered envelope', () => {
    expect(viewportInsideFetchedBuffer(base, '8,8,18,18')).toBe(false);
    expect(shouldUpdateMapBbox(base, '8,8,18,18')).toBe(true);
  });
});

describe('shouldUseViewportInfraLoad', () => {
  const bbox = '0,0,1,1';

  it('uses viewport while full list is still loading', () => {
    expect(
      shouldUseViewportInfraLoad({
        mapEditEnabled: false,
        mapBbox: bbox,
        infraCount: 0,
        fullListLoading: true,
      }),
    ).toBe(true);
  });

  it('uses viewport for large projects after full list loaded', () => {
    expect(
      shouldUseViewportInfraLoad({
        mapEditEnabled: false,
        mapBbox: bbox,
        infraCount: MAP_VIEWPORT_MIN_OBJECTS,
        fullListLoading: false,
      }),
    ).toBe(true);
  });

  it('falls back to full list for small projects when load finished', () => {
    expect(
      shouldUseViewportInfraLoad({
        mapEditEnabled: false,
        mapBbox: bbox,
        infraCount: MAP_VIEWPORT_MIN_OBJECTS - 1,
        fullListLoading: false,
      }),
    ).toBe(false);
  });

  it('disabled in edit mode', () => {
    expect(
      shouldUseViewportInfraLoad({
        mapEditEnabled: true,
        mapBbox: bbox,
        infraCount: 200,
        fullListLoading: false,
      }),
    ).toBe(false);
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
