import { describe, expect, it } from 'vitest';
import {
  computeHorizonBoundsFromInfra,
  demandIncrementForYear,
  effectiveSandDemandM3,
  mergeSandVolumeForSave,
  readSandVolumeByYear,
  readSandVolumeInputMode,
  sandDemandPlanTotalM3,
} from './infraSandVolumes';

describe('effectiveSandDemandM3', () => {
  it('uses single sand_volume_m3 when no yearly plan', () => {
    const r = effectiveSandDemandM3({ sand_volume_m3: 1000 }, '2020-01-01', '2025-06-01');
    expect(r.effective).toBe(1000);
    expect(r.planTotal).toBe(1000);
  });

  it('returns zero when not in service', () => {
    const r = effectiveSandDemandM3({ sand_volume_m3: 1000 }, '2030-01-01', '2025-06-01');
    expect(r.effective).toBe(0);
    expect(r.planTotal).toBe(1000);
  });

  it('accumulates yearly plan through as_of', () => {
    const r = effectiveSandDemandM3(
      { sand_volume_by_year: { '2024': 500, '2025': 300, '2026': 200 } },
      '2024-06-01',
      '2025-03-01',
    );
    expect(r.planTotal).toBe(1000);
    expect(r.effective).toBe(800);
    expect(r.breakdown).toEqual({ '2024': 500, '2025': 300 });
  });

  it('readSandVolumeByYear filters invalid keys', () => {
    expect(
      readSandVolumeByYear({ sand_volume_by_year: { '2025': 100, bad: 50, '2026': -1 } }),
    ).toEqual({ '2025': 100 });
  });

  it('sandDemandPlanTotalM3 prefers yearly plan', () => {
    expect(
      sandDemandPlanTotalM3({
        sand_volume_m3: 999,
        sand_volume_by_year: { '2025': 100, '2026': 50 },
      }),
    ).toBe(150);
  });

  it('readSandVolumeInputMode respects explicit single mode', () => {
    expect(
      readSandVolumeInputMode({
        sand_volume_mode: 'single',
        sand_volume_by_year: { '2025': 100 },
      }),
    ).toBe('single');
    expect(
      sandDemandPlanTotalM3({
        sand_volume_mode: 'single',
        sand_volume_m3: 500,
        sand_volume_by_year: { '2025': 100 },
      }),
    ).toBe(500);
  });

  it('mergeSandVolumeForSave clears alternate storage', () => {
    const saved = mergeSandVolumeForSave(
      { sand_volume_m3: 1000, sand_volume_by_year: { '2025': 200 } },
      'single',
      800,
      { '2026': 300 },
    );
    expect(saved.sand_volume_mode).toBe('single');
    expect(saved.sand_volume_m3).toBe(800);
    expect(saved.sand_volume_by_year).toBeUndefined();

    const yearly = mergeSandVolumeForSave(saved, 'yearly', 800, { '2025': 100 });
    expect(yearly.sand_volume_mode).toBe('yearly');
    expect(yearly.sand_volume_by_year).toEqual({ '2025': 100 });
    expect(yearly.sand_volume_m3).toBeUndefined();
  });

  it('demandIncrementForYear single mode only in entry year', () => {
    expect(
      demandIncrementForYear({ sand_volume_m3: 1000, sand_volume_mode: 'single' }, '2024-06-01', 2024),
    ).toBe(1000);
    expect(
      demandIncrementForYear({ sand_volume_m3: 1000, sand_volume_mode: 'single' }, '2024-06-01', 2025),
    ).toBe(0);
  });

  it('computeHorizonBoundsFromInfra uses min entry and max plan year', () => {
    const bounds = computeHorizonBoundsFromInfra([
      {
        subtype: 'oil_pad',
        properties: { entry_date: '2022-03-01', sand_volume_by_year: { '2027': 100 } },
      },
      {
        subtype: 'sand_quarry',
        properties: { entry_date: '2024-01-01' },
      },
    ] as never);
    expect(bounds.horizonFrom).toBe('2022-03-01');
    expect(bounds.horizonTo).toBe('2027-12-31');
  });
});
