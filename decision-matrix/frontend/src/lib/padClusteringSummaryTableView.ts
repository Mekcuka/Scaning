import type { TransposedSummaryTable } from './padClusteringSummaryRows';

export const SUMMARY_ROW_SORT_KEY = '__row__';

export type SummarySortDirection = 'asc' | 'desc';

export type SummaryTableRow = TransposedSummaryTable['rows'][number];

export type SummaryColumnFilterOptions = Record<string, string[]>;

export function parseSummarySortValue(raw: string): number | string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—') return null;
  const normalized = trimmed.replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  return trimmed.toLocaleLowerCase('ru');
}

export function compareSummaryCellValues(
  left: string,
  right: string,
  direction: SummarySortDirection,
): number {
  const a = parseSummarySortValue(left);
  const b = parseSummarySortValue(right);
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const cmp =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'ru', { numeric: true });
  return direction === 'asc' ? cmp : -cmp;
}

export function filterSummaryRows(
  rows: SummaryTableRow[],
  paramLabels: string[],
  input: {
    search: string;
    columnFilters: Record<string, string>;
  },
): SummaryTableRow[] {
  const query = input.search.trim().toLowerCase();
  const activeFilters = Object.entries(input.columnFilters).filter(([, value]) => value.trim());

  return rows.filter((row) => {
    if (query) {
      const haystack = [row.label, ...paramLabels.map((key) => row.values[key] ?? '')]
        .join('\u0001')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    for (const [key, value] of activeFilters) {
      const cell = key === SUMMARY_ROW_SORT_KEY ? row.label : (row.values[key] ?? '—');
      if (cell !== value) return false;
    }
    return true;
  });
}

export function sortSummaryRows(
  rows: SummaryTableRow[],
  sortKey: string,
  direction: SummarySortDirection,
): SummaryTableRow[] {
  if (rows.length < 2) return rows;
  return [...rows].sort((left, right) => {
    const leftValue = sortKey === SUMMARY_ROW_SORT_KEY ? left.label : (left.values[sortKey] ?? '—');
    const rightValue = sortKey === SUMMARY_ROW_SORT_KEY ? right.label : (right.values[sortKey] ?? '—');
    const cmp = compareSummaryCellValues(leftValue, rightValue, direction);
    if (cmp !== 0) return cmp;
    return left.label.localeCompare(right.label, 'ru');
  });
}

export function columnLabelByKey(table: TransposedSummaryTable, key: string): string {
  if (key === SUMMARY_ROW_SORT_KEY) return 'Объект';
  for (const col of table.columns) {
    if (col.kind === 'single' && col.key === key) return col.label;
    if (col.kind === 'group') {
      const child = col.columns.find((item) => item.key === key);
      if (child) return `${col.label} · ${child.label}`;
    }
  }
  return key;
}

export function buildSummaryFilterOptions(
  table: TransposedSummaryTable,
  rows: SummaryTableRow[],
): SummaryColumnFilterOptions {
  const options: SummaryColumnFilterOptions = {};

  const pushOptions = (key: string) => {
    const values = new Set<string>();
    for (const row of rows) {
      const raw = key === SUMMARY_ROW_SORT_KEY ? row.label : (row.values[key] ?? '—');
      if (raw && raw !== '—') values.add(raw);
    }
    const list = [...values].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
    if (list.length > 0) {
      options[key] = list;
    }
  };

  pushOptions(SUMMARY_ROW_SORT_KEY);
  for (const key of table.paramLabels) {
    pushOptions(key);
  }
  return options;
}

export function hasActiveSummaryFilters(
  search: string,
  columnFilters: Record<string, string>,
): boolean {
  if (search.trim()) return true;
  return Object.values(columnFilters).some((value) => value.trim());
}
