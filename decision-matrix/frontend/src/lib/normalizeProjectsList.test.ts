import { describe, expect, it } from 'vitest';
import { normalizeProjectsList } from './normalizeProjectsList';
import { makeProject } from '../test/fixtures/projects';

describe('normalizeProjectsList', () => {
  it('returns [] for null and undefined (React Query may yield null, not default [])', () => {
    expect(normalizeProjectsList(null)).toEqual([]);
    expect(normalizeProjectsList(undefined)).toEqual([]);
  });

  it('returns [] for non-array values', () => {
    expect(normalizeProjectsList({} as never)).toEqual([]);
    expect(normalizeProjectsList(0 as never)).toEqual([]);
    expect(normalizeProjectsList('x' as never)).toEqual([]);
  });

  it('passes through valid arrays including empty', () => {
    const list = [makeProject()];
    expect(normalizeProjectsList(list)).toBe(list);
    expect(normalizeProjectsList([])).toEqual([]);
  });

  it('allows safe .length and .find on result', () => {
    const list = normalizeProjectsList(null);
    expect(list.length).toBe(0);
    expect(list.find(() => true)).toBeUndefined();
  });
});
