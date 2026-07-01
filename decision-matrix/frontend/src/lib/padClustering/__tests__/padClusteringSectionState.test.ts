import { beforeEach, describe, expect, it } from 'vitest';
import {
  readPadClusteringSectionOpen,
  writePadClusteringSectionOpen,
} from '../padClusteringSectionState';

describe('padClusteringSectionState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaultOpen when nothing saved', () => {
    expect(readPadClusteringSectionOpen('pad-clustering-section-layout', true)).toBe(true);
    expect(readPadClusteringSectionOpen('pad-clustering-section-pad', false)).toBe(false);
  });

  it('persists and restores section open state', () => {
    writePadClusteringSectionOpen('pad-clustering-section-layout', false);
    writePadClusteringSectionOpen('pad-clustering-section-trajectory', true);
    expect(readPadClusteringSectionOpen('pad-clustering-section-layout', true)).toBe(false);
    expect(readPadClusteringSectionOpen('pad-clustering-section-trajectory', false)).toBe(true);
    expect(readPadClusteringSectionOpen('pad-clustering-section-pad', true)).toBe(true);
  });
});
