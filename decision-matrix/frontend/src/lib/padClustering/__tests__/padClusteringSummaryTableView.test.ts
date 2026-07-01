import { describe, expect, it } from 'vitest';

import type { TransposedSummaryTable } from '../padClusteringSummaryRows';
import {
  SUMMARY_ROW_SORT_KEY,
  buildSummaryFilterOptions,
  compareSummaryCellValues,
  filterSummaryRows,
  parseSummarySortValue,
  sortSummaryRows,
} from '../padClusteringSummaryTableView';

const rows = [
  {
    key: 'bh-8',
    label: 'Забой · ГС_8',
    values: {
      role: 'Основной',
      type: 'ГС',
      well: '6',
      tvd: '1 500',
      traj: 'design',
    },
  },
  {
    key: 'bh-9',
    label: 'Доп.ствол · ГС_9',
    values: {
      role: 'Доп.ствол',
      type: 'ГС',
      well: '2',
      tvd: '1 200',
      traj: 'нет survey',
    },
  },
  {
    key: 'bh-1',
    label: 'Забой · ГС_1',
    values: {
      role: 'Основной',
      type: 'ГС',
      well: '1',
      tvd: '—',
      traj: 'design',
    },
  },
  {
    key: 'bh-8-dup',
    label: 'Забой · ГС_8',
    values: {
      role: 'Основной',
      type: 'ГС',
      well: '7',
      tvd: '1 600',
      traj: 'design',
    },
  },
];

const paramLabels = ['role', 'type', 'well', 'tvd', 'traj'];

describe('padClusteringSummaryTableView', () => {
  it('parseSummarySortValue handles ru-RU numbers and dashes', () => {
    expect(parseSummarySortValue('—')).toBeNull();
    expect(parseSummarySortValue('1 500')).toBe(1500);
    expect(parseSummarySortValue('73,24')).toBeCloseTo(73.24);
    expect(parseSummarySortValue('design')).toBe('design');
  });

  it('sortSummaryRows preserves row count and stable keys with duplicate labels', () => {
    const sorted = sortSummaryRows(rows, 'tvd', 'asc');
    expect(sorted).toHaveLength(rows.length);
    expect(new Set(sorted.map((row) => row.key)).size).toBe(rows.length);
    expect(sorted.map((row) => row.key)).toEqual(['bh-9', 'bh-8', 'bh-8-dup', 'bh-1']);
  });

  it('filterSummaryRows applies search and column filters', () => {
    const filtered = filterSummaryRows(rows, paramLabels, {
      search: 'доп',
      columnFilters: {},
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe('Доп.ствол · ГС_9');

    const byRole = filterSummaryRows(rows, paramLabels, {
      search: '',
      columnFilters: { role: 'Основной' },
    });
    expect(byRole).toHaveLength(3);
  });

  it('compareSummaryCellValues respects direction', () => {
    expect(compareSummaryCellValues('2', '10', 'asc')).toBeLessThan(0);
    expect(compareSummaryCellValues('2', '10', 'desc')).toBeGreaterThan(0);
  });

  it('buildSummaryFilterOptions includes every column with values', () => {
    const table: TransposedSummaryTable = {
      columns: [
        { kind: 'single', key: 'role', label: 'Роль' },
        { kind: 'single', key: 'type', label: 'Тип' },
        { kind: 'single', key: 'well', label: 'Скважина №' },
        { kind: 'single', key: 'tvd', label: 'TVD, м' },
        { kind: 'single', key: 'traj', label: 'Траектория' },
      ],
      paramLabels,
      rows,
    };
    const options = buildSummaryFilterOptions(table, rows);
    expect(options[SUMMARY_ROW_SORT_KEY]).toBeDefined();
    expect(options.role).toBeDefined();
    expect(options.type).toBeDefined();
    expect(options.well).toBeDefined();
    expect(options.tvd).toBeDefined();
    expect(options.traj).toBeDefined();
  });
});
