import { describe, expect, it } from 'vitest';
import {
  clearanceLineColor,
  formatMinSf,
  wellTrajectoryDisplayColor,
  wellTrajectoryPaletteColor,
} from '../../wellTrajectoryClearance';

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

describe('formatMinSf', () => {
  it('returns em dash for null, undefined, and non-finite values', () => {
    expect(formatMinSf(null)).toBe('—');
    expect(formatMinSf(undefined)).toBe('—');
    expect(formatMinSf(Number.NaN)).toBe('—');
  });

  it('formats finite numbers', () => {
    expect(formatMinSf(1.234)).toBe('1.23');
    expect(formatMinSf(0.5, 1)).toBe('0.5');
  });
});

describe('wellTrajectoryDisplayColor', () => {
  it('returns palette color by well index when SF ok or missing', () => {
    expect(wellTrajectoryDisplayColor(0, null, 1)).toBe(wellTrajectoryPaletteColor(0));
    expect(wellTrajectoryDisplayColor(1, 1.2, 1)).toBe('#22c55e');
  });

  it('returns red when SF below threshold', () => {
    expect(wellTrajectoryDisplayColor(2, 0.85, 1)).toBe('#c62828');
  });
});
