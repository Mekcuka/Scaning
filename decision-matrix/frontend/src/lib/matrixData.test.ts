import { describe, expect, it } from 'vitest';
import {
  buildMatrixRowsByPois,
  internalMatrixCellParts,
  externalLinearMatrixCellParts,
} from './matrixData';
import type { POI } from './api';

describe('matrixData', () => {
  it('internalMatrixCellParts formats cost', () => {
    const parts = internalMatrixCellParts({ cost_mln: 12.5, subtype: 'pads', pads_count: 3 });
    expect(parts.text).toContain('12.5');
    expect(parts.subtext).toContain('3');
  });

  it('externalLinearMatrixCellParts handles not_required', () => {
    expect(externalLinearMatrixCellParts({ status: 'not_required' }).text).toBe('Не треб.');
  });

  it('buildMatrixRowsByPois includes fluid row per POI column', () => {
    const pois = [
      {
        id: 'p1',
        name: 'Точка_1',
        fluid_type: 'oil',
        planned_production_volume: 120,
      },
      {
        id: 'p2',
        name: 'Точка_2',
        fluid_type: 'gas',
        planned_production_volume: 0,
      },
    ] as POI[];

    const { rows } = buildMatrixRowsByPois(pois, [
      { rows: [], total_cost_mln: null },
      { rows: [], total_cost_mln: null },
    ]);

    const fluidRow = rows.find((r) => r.label === 'Флюид');
    expect(fluidRow?.section).toBe('Точка интереса');
    expect(fluidRow?.cells[0]).toEqual({ text: 'Нефть', subtext: '120 тыс. т/год' });
    expect(fluidRow?.cells[1]).toEqual({ text: 'Газ', subtext: undefined });
  });
});
