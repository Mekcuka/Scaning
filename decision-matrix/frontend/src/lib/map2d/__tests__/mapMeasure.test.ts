import { describe, expect, it } from 'vitest';
import { formatLengthMeters, previewSegmentMeasureLabel } from '../mapMeasure';

describe('mapMeasure', () => {
  it('formats meters and kilometers', () => {
    expect(formatLengthMeters(42)).toBe('42 м');
    expect(formatLengthMeters(1500)).toBe('1.50 км');
  });

  it('builds preview label for GS heel-to-cursor segment', () => {
    const label = previewSegmentMeasureLabel(
      { lon: 37.62, lat: 55.76 },
      { lon: 37.63, lat: 55.76 },
    );
    expect(label).not.toBeNull();
    expect(label!.lon).toBe(37.63);
    expect(label!.text).toMatch(/м|км/);
    expect(label!.text).not.toBe('0 м');
  });

  it('returns null for coincident points', () => {
    expect(
      previewSegmentMeasureLabel({ lon: 1, lat: 2 }, { lon: 1, lat: 2 }),
    ).toBeNull();
  });
});
