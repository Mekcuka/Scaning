import { describe, expect, it } from 'vitest';

import type { WellTrajectory } from '../api/wellTrajectoryApi';
import {
  buildBottomholeSummaryRows,
  buildBottomholeSummaryTable,
  buildPadSummaryRows,
  buildPadSummaryTable,
  buildPadsSummaryTable,
  buildTrajectorySummaryRows,
  buildTransposedSummaryTable,
  buildUnifiedSummaryRows,
  buildWellengSummaryRows,
  sumTrajectoryMdMeters,
  trajectoryHorizontalReachM,
} from './padClusteringSummaryRows';
import { calcDraftFromSources } from './padClusteringCalcSettings';
import { makeInfraPoint } from '../../test/fixtures/infra';

describe('padClusteringSummaryRows', () => {
  it('buildPadSummaryRows formats pad metadata', () => {
    const pad = makeInfraPoint({
      id: 'pad-1',
      subtype: 'oil_pad',
      name: 'Куст_A',
    });
    const rows = buildPadSummaryRows({
      pad,
      kbM: 152,
      wellsLocalCount: 3,
      trajectoryComputedAt: '2026-01-01T12:00:00Z',
      demSource: 'local',
    });
    expect(rows.find((r) => r.label === 'Имя')?.value).toBe('Куст_A');
    expect(rows.find((r) => r.label === 'KB, м')?.value).toBe('152');
    expect(rows.find((r) => r.label === 'Устьев на площадке')?.value).toBe('3');
    expect(rows.find((r) => r.label === 'Суммарный MD, м')?.value).toBe('—');
  });

  it('buildPadSummaryRows sums MD max across trajectories', () => {
    const pad = makeInfraPoint({ id: 'pad-1', subtype: 'oil_pad', name: 'Куст_A' });
    const trajectories: WellTrajectory[] = [
      {
        well_index: 0,
        survey: { stations: [{ md: 0, tvd: 0 }, { md: 1200, tvd: 1100 }] },
      },
      {
        well_index: 1,
        survey: { stations: [{ md: 0, tvd: 0 }, { md: 800, tvd: 750 }] },
      },
    ];
    expect(sumTrajectoryMdMeters(trajectories)).toBe(2000);
    const rows = buildPadSummaryRows({
      pad,
      kbM: 100,
      wellsLocalCount: 2,
      trajectoryComputedAt: null,
      demSource: null,
      trajectories,
    });
    expect(rows.find((r) => r.label === 'Суммарный MD, м')?.value).toBe('2 000');
  });

  it('buildWellengSummaryRows reads calc draft fields', () => {
    const draft = calcDraftFromSources({ properties: { well_trajectory_step_m: 25 } });
    const rows = buildWellengSummaryRows(draft, {
      default_error_model: 'ISCWSA',
      default_azi_reference: 'grid',
      sf_warning_threshold: 1,
    });
    expect(rows.find((r) => r.label === 'Шаг MD, м')?.value).toBe('25');
    expect(rows.some((r) => r.label === 'Модель погрешности')).toBe(true);
  });

  it('buildTrajectorySummaryRows marks design status', () => {
    const trajectories: WellTrajectory[] = [
      {
        well_index: 0,
        name: 'W1',
        survey: {
          stations: [
            { md: 0, tvd: 0 },
            { md: 100, tvd: 95 },
          ],
        },
        target: { tvd_m: 1500 },
      },
    ];
    const groups = buildTrajectorySummaryRows(trajectories);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.find((r) => r.label === 'Статус')?.value).toBe('design');
  });

  it('buildBottomholeSummaryRows nests lateral under main in order', () => {
    const main = makeInfraPoint({
      id: 'main-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Main BH',
      properties: { well_bottomhole_role: 'main', well_bottomhole_well_index: 0 },
    });
    const lateral = makeInfraPoint({
      id: 'lat-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Lat BH',
      properties: {
        well_bottomhole_role: 'lateral',
        well_bottomhole_parent_id: 'main-1',
        well_bottomhole_well_index: 0,
      },
    });
    const nameById = new Map([
      ['main-1', 'Main BH'],
      ['lat-1', 'Lat BH'],
    ]);
    const groups = buildBottomholeSummaryRows([main, lateral], nameById);
    expect(groups).toHaveLength(2);
    expect(groups[1]!.find((r) => r.label === 'Роль')?.value).toBe('Доп.ствол');
  });

  it('buildPadsSummaryTable transposes one row per pad', () => {
    const padA = makeInfraPoint({ id: 'pad-a', subtype: 'oil_pad', name: 'Куст_A' });
    const padB = makeInfraPoint({ id: 'pad-b', subtype: 'oil_pad', name: 'Куст_B' });
    const table = buildPadsSummaryTable([
      {
        padId: 'pad-a',
        rows: buildPadSummaryRows({
          pad: padA,
          kbM: 100,
          wellsLocalCount: 2,
          trajectoryComputedAt: null,
          demSource: null,
        }),
      },
      {
        padId: 'pad-b',
        rows: buildPadSummaryRows({
          pad: padB,
          kbM: 200,
          wellsLocalCount: 4,
          trajectoryComputedAt: null,
          demSource: null,
        }),
      },
    ]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows.map((row) => row.label)).toEqual(['Куст_A', 'Куст_B']);
    expect(table.paramLabels).toContain('KB, м');
  });

  it('buildPadSummaryTable transposes pad params into columns', () => {
    const pad = makeInfraPoint({ id: 'pad-1', subtype: 'oil_pad', name: 'Куст_A' });
    const padRows = buildPadSummaryRows({
      pad,
      kbM: 100,
      wellsLocalCount: 2,
      trajectoryComputedAt: null,
      demSource: null,
    });
    const table = buildPadSummaryTable(padRows);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.label).toBe('Куст');
    expect(table.paramLabels).toContain('Имя');
    expect(table.rows[0]!.values['Имя']).toBe('Куст_A');
  });

  it('buildBottomholeSummaryRows includes GS and trajectory fields', () => {
    const gs = makeInfraPoint({
      id: 'gs-1',
      subtype: 'well_bottomhole_gs',
      name: 'ГС_1',
      lon: 73.4,
      lat: 61.2,
      end_lon: 73.41,
      end_lat: 61.21,
      properties: {
        well_bottomhole_role: 'main',
        well_bottomhole_well_index: 0,
        well_bottomhole_tvd_m: 1500,
        well_bottomhole_heel_tvd_m: 1480,
        well_bottomhole_toe_tvd_m: 1520,
        well_bottomhole_gs_entry_mode: 'heel',
        well_bottomhole_target_azi: 45,
      },
    });
    const trajectories: WellTrajectory[] = [
      {
        well_index: 0,
        survey: { stations: [{ md: 0, tvd: 0 }, { md: 2100, tvd: 1500 }] },
        clearance: { min_sf: 1.25 },
      },
    ];
    const rows = buildBottomholeSummaryRows([gs], new Map([['gs-1', 'ГС_1']]), trajectories)[0]!;
    expect(rows.find((r) => r.label === 'Тип')?.value).toBeTruthy();
    expect(rows.find((r) => r.label === 'TVD Т1, м')?.value).toBe('1 480');
    expect(rows.find((r) => r.label === 'TVD Т3, м')?.value).toBe('1 520');
    expect(rows.find((r) => r.label === 'Точка входа')?.value).toBe('Т1');
    expect(rows.find((r) => r.label === 'Azi, °')?.value).toBe('45');
    expect(rows.find((r) => r.label === 'MD max, м')?.value).toBe('2 100');
    expect(rows.find((r) => r.label === 'Min SF')?.value).toBe('1,25');
    expect(rows.find((r) => r.label === 'Отход, м')?.value).toBe('—');
    expect(rows.find((r) => r.key === 'gs.t1.x')?.value).toBe('73,4');
    expect(rows.find((r) => r.key === 'gs.t3.y')?.value).toBe('61,21');
    const table = buildBottomholeSummaryTable([rows]);
    const t1Group = table.columns.find((c) => c.kind === 'group' && c.label === 'Т1');
    expect(t1Group?.kind).toBe('group');
    if (t1Group?.kind === 'group') {
      expect(t1Group.columns.map((c) => c.label)).toEqual(['X', 'Y']);
    }
  });

  it('buildBottomholeSummaryTable labels rows as Забой and Доп.ствол', () => {
    const main = makeInfraPoint({
      id: 'main-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Main BH',
      properties: { well_bottomhole_role: 'main', well_bottomhole_well_index: 0 },
    });
    const lateral = makeInfraPoint({
      id: 'lat-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Lat BH',
      properties: {
        well_bottomhole_role: 'lateral',
        well_bottomhole_parent_id: 'main-1',
        well_bottomhole_well_index: 0,
      },
    });
    const nameById = new Map([
      ['main-1', 'Main BH'],
      ['lat-1', 'Lat BH'],
    ]);
    const groups = buildBottomholeSummaryRows([main, lateral], nameById);
    const table = buildBottomholeSummaryTable(groups);
    expect(table.rows.map((r) => r.label)).toEqual(['Забой · Main BH', 'Доп.ствол · Lat BH']);
    expect(table.paramLabels).toContain('Роль');
  });

  it('buildBottomholeSummaryTable puts Куст and Скважина № first', () => {
    const main = makeInfraPoint({
      id: 'main-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Main BH',
      properties: { well_bottomhole_role: 'main', well_bottomhole_well_index: 2 },
    });
    const rows = buildBottomholeSummaryRows([main], new Map([['main-1', 'Main BH']]))[0]!;
    const table = buildBottomholeSummaryTable([rows], ['main-1'], ['Куст 1']);
    const singleLabels = table.columns
      .filter((col) => col.kind === 'single')
      .map((col) => (col.kind === 'single' ? col.label : ''));
    expect(singleLabels.slice(0, 2)).toEqual(['Куст', 'Скважина №']);
    expect(table.paramLabels.slice(0, 2)).toEqual(['Куст', 'Скважина №']);
  });

  it('buildTransposedSummaryTable groups nested coordinate columns', () => {
    const table = buildTransposedSummaryTable([
      {
        rowLabel: 'Забой · A',
        params: [
          { key: 'gs.t1.x', headerGroup: 'Т1', label: 'X', value: '1' },
          { key: 'gs.t1.y', headerGroup: 'Т1', label: 'Y', value: '2' },
          { key: 'gs.t3.x', headerGroup: 'Т3', label: 'X', value: '3' },
          { key: 'gs.t3.y', headerGroup: 'Т3', label: 'Y', value: '4' },
        ],
      },
    ]);
    expect(table.paramLabels).toEqual(['gs.t1.x', 'gs.t1.y', 'gs.t3.x', 'gs.t3.y']);
    expect(table.columns.filter((c) => c.kind === 'group')).toHaveLength(2);
  });

  it('buildTransposedSummaryTable unions param columns across rows', () => {
    const table = buildTransposedSummaryTable([
      { rowLabel: 'Куст', params: [{ label: 'Имя', value: 'A' }, { label: 'KB, м', value: '1' }] },
      { rowLabel: 'Забой · B', params: [{ label: 'Имя', value: 'B' }, { label: 'TVD, м', value: '2000' }] },
    ]);
    expect(table.paramLabels).toEqual(['Имя', 'KB, м', 'TVD, м']);
    expect(table.rows[1]!.values['KB, м']).toBeUndefined();
  });

  it('buildUnifiedSummaryRows flattens sections into one table', () => {
    const pad = makeInfraPoint({ id: 'pad-1', subtype: 'oil_pad', name: 'Куст_A' });
    const rows = buildUnifiedSummaryRows({
      padRows: buildPadSummaryRows({
        pad,
        kbM: 100,
        wellsLocalCount: 1,
        trajectoryComputedAt: null,
        demSource: null,
      }),
      wellengRows: buildWellengSummaryRows(calcDraftFromSources({}), null),
      trajectoryGroups: [],
      bottomholeGroups: [],
      pywellgeoGroups: [],
      emptyHints: {
        trajectories: 'нет траекторий',
        bottomholes: 'нет забоев',
        pywellgeo: 'нет pywellgeo',
      },
    });
    expect(rows.some((r) => r.kind === 'data' && r.section === 'Куст' && r.label === 'Имя')).toBe(true);
    expect(rows.some((r) => r.kind === 'empty' && r.section === 'Скважины (основной ствол)')).toBe(true);
  });

  it('trajectoryHorizontalReachM returns max plan displacement from wellhead', () => {
    const trajectory: WellTrajectory = {
      well_index: 0,
      survey: {
        stations: [
          { md: 0, tvd: 0, n: 0, e: 0 },
          { md: 500, tvd: 480, n: 200, e: 0 },
          { md: 2000, tvd: 1500, n: 300, e: 400 },
        ],
      },
    };
    expect(trajectoryHorizontalReachM(trajectory)).toBeCloseTo(500, 1);
  });

  it('trajectoryHorizontalReachM returns null when no horizontal coords', () => {
    const trajectory: WellTrajectory = {
      well_index: 0,
      survey: { stations: [{ md: 0, tvd: 0 }, { md: 100, tvd: 95 }] },
    };
    expect(trajectoryHorizontalReachM(trajectory)).toBeNull();
  });

  it('buildBottomholeSummaryRows includes Отход column from trajectory', () => {
    const gs = makeInfraPoint({
      id: 'gs-1',
      subtype: 'well_bottomhole_gs',
      name: 'ГС_1',
      properties: {
        well_bottomhole_role: 'main',
        well_bottomhole_well_index: 0,
        well_bottomhole_tvd_m: 1500,
      },
    });
    const trajectories: WellTrajectory[] = [
      {
        well_index: 0,
        survey: {
          stations: [
            { md: 0, tvd: 0, n: 0, e: 0 },
            { md: 2000, tvd: 1500, n: 300, e: 400 },
          ],
        },
      },
    ];
    const rows = buildBottomholeSummaryRows([gs], new Map([['gs-1', 'ГС_1']]), trajectories)[0]!;
    expect(rows.find((r) => r.label === 'Отход, м')?.value).toBe('500');
  });

  it('buildBottomholeSummaryRows shows — for Отход when no trajectory', () => {
    const gs = makeInfraPoint({
      id: 'gs-1',
      subtype: 'well_bottomhole_gs',
      name: 'ГС_1',
      properties: {
        well_bottomhole_role: 'main',
        well_bottomhole_well_index: 0,
        well_bottomhole_tvd_m: 1500,
      },
    });
    const rows = buildBottomholeSummaryRows([gs], new Map([['gs-1', 'ГС_1']]))[0]!;
    expect(rows.find((r) => r.label === 'Отход, м')?.value).toBe('—');
  });
});
