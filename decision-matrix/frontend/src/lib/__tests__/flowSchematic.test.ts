import { describe, expect, it } from 'vitest';
import { kindStyle, resolveSeparationShare, nodeHasThroughputCapacity } from '../flowSchematic';

describe('flowSchematic', () => {
  it('kindStyle returns border color for known kinds', () => {
    const style = kindStyle('poi', 'oil');
    expect(style.border).toBeTruthy();
  });

  it('resolveSeparationShare normalizes percent to fraction', () => {
    expect(resolveSeparationShare(150)).toBe(0.85);
    expect(resolveSeparationShare(null)).toBe(0.85);
    expect(resolveSeparationShare(50)).toBe(0.5);
  });

  it('nodeHasThroughputCapacity includes poi', () => {
    expect(nodeHasThroughputCapacity('poi')).toBe(true);
    expect(nodeHasThroughputCapacity('separator')).toBe(true);
  });
});
