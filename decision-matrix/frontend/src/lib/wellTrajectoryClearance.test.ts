import { describe, expect, it } from 'vitest';
import { clearanceLineColor } from './wellTrajectoryClearance';

describe('clearanceLineColor', () => {
  it('returns default when min_sf missing', () => {
    expect(clearanceLineColor(null, 1)).toBe('#1565c0');
    expect(clearanceLineColor(undefined, 1)).toBe('#1565c0');
  });

  it('returns red when below threshold', () => {
    expect(clearanceLineColor(0.85, 1)).toBe('#c62828');
  });

  it('returns green when at or above threshold', () => {
    expect(clearanceLineColor(1.0, 1)).toBe('#2e7d32');
    expect(clearanceLineColor(1.5, 1)).toBe('#2e7d32');
  });
});
