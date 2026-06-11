import { describe, expect, it } from 'vitest';
import {
  buildMatrixRowsByPois,
  internalMatrixCellParts,
  externalLinearMatrixCellParts,
} from './matrixData';
import { buildEngineeringMatrixRows } from './matrixData/engineeringRows';
import type { POI } from './api';

describe('matrixData', () => {
  it('internalMatrixCellParts formats cost', () => {
    const parts = internalMatrixCellParts({ cost_mln: 12.5, subtype: 'pads', pads_count: 3 });
    expect(parts.text).toContain('12.5');
    expect(parts.subtext).toContain('3');
  });

  it('internalMatrixCellParts shows not required status', () => {
    expect(internalMatrixCellParts({ status: 'not_required', subtype: 'gas_pipeline' }).text).toBe(
      'Не требуется'
    );
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

  it('buildEngineeringMatrixRows shows not required for gas PPD and oil prep', () => {
    const gasPoi = {
      id: 'g1',
      name: 'Газ',
      fluid_type: 'gas',
      eng_injection: 'centralized',
      eng_oil_preparation: 'mkos',
      eng_power: 'external',
    } as POI;
    const oilPoi = {
      id: 'o1',
      name: 'Нефть',
      fluid_type: 'oil',
      eng_injection: 'centralized',
      eng_oil_preparation: 'mkos',
      eng_power: 'external',
    } as POI;

    const rows = buildEngineeringMatrixRows([gasPoi, oilPoi]);
    const injection = rows.find((r) => r.engineeringKey === 'eng_injection');
    const oilPrep = rows.find((r) => r.engineeringKey === 'eng_oil_preparation');
    const power = rows.find((r) => r.engineeringKey === 'eng_power');

    expect(injection?.cells[0]).toEqual({ text: 'Не требуется' });
    expect(injection?.cells[1]).toEqual({ text: 'Централиз.', badge: true });
    expect(oilPrep?.cells[0]).toEqual({ text: 'Не требуется' });
    expect(oilPrep?.cells[1]).toEqual({ text: 'МКОС', badge: true });
    expect(power?.cells[0]).toEqual({ text: 'Внешнее', badge: true });
    expect(power?.cells[1]).toEqual({ text: 'Внешнее', badge: true });
  });

  it('buildMatrixRowsByPois includes gas pipeline in internal section', () => {
    const pois = [
      { id: 'g1', name: 'Газ', fluid_type: 'gas', planned_production_volume: 100 },
    ] as POI[];
    const { rows } = buildMatrixRowsByPois(pois, [{ rows: [], total_cost_mln: null }]);
    const gasPipe = rows.find((r) => r.label === 'Газопровод');
    expect(gasPipe?.section).toBe('Внутренние решения');
    expect(gasPipe?.subtype).toBe('gas_pipeline');
    expect(gasPipe?.paramType).toBe('internal');
  });
});
