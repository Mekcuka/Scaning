import type { AnalysisRow, POI } from './api';
import {
  engineeringAppliesToFluid,
  type MatrixCell,
  type MatrixRow,
  type PoiColumnAnalysis,
} from './matrixData';
import { formatExternalDistanceBlock } from './analysisDisplay';
import { engineeringOptionsForKey } from './poiParams';

export interface MatrixCardAlternative {
  label: string;
  active: boolean;
}

export interface MatrixCardModel {
  title: string;
  alternatives: MatrixCardAlternative[];
  footer: string;
  exceeds: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  within_limit: 'В пределах лимита',
  exceeds_limit: 'Превышение',
  not_required: 'Не требуется',
  construction_required: 'Строительство',
};

export function getMatrixSectionOrder(rows: MatrixRow[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    if (row.total) continue;
    if (!seen.has(row.section)) {
      seen.add(row.section);
      order.push(row.section);
    }
  }
  return order;
}

export type MatrixCardSectionGroup = { section: string; rows: MatrixRow[] };

export function matrixRowHasCardData(
  row: MatrixRow,
  column: PoiColumnAnalysis,
  poi?: POI,
): boolean {
  if (row.total) return false;
  if (row.section === 'Точка интереса') return true;
  if (row.engineering) {
    if (
      row.engineeringKey &&
      poi &&
      !engineeringAppliesToFluid(row.engineeringKey, poi.fluid_type)
    ) {
      return false;
    }
    return true;
  }
  return findAnalysisItem(column, row) != null;
}

export function partitionMatrixRowsForCardGroups(
  rows: MatrixRow[],
  column: PoiColumnAnalysis,
  poi?: POI,
): MatrixCardSectionGroup[] {
  const groups: MatrixCardSectionGroup[] = [];
  for (const section of getMatrixSectionOrder(rows)) {
    const sectionRows = rows.filter(
      (row) =>
        row.section === section &&
        !row.total &&
        matrixRowHasCardData(row, column, poi),
    );
    if (sectionRows.length > 0) {
      groups.push({ section, rows: sectionRows });
    }
  }
  return groups;
}

function findAnalysisItem(
  column: PoiColumnAnalysis,
  row: MatrixRow
): AnalysisRow | undefined {
  if (!row.subtype || !row.paramType) return undefined;
  return column.rows.find(
    (r) => r.subtype === row.subtype && r.param_type === row.paramType
  );
}

function buildEngineeringAlternatives(
  row: MatrixRow,
  poi: POI | undefined
): MatrixCardAlternative[] {
  const key = row.engineeringKey;
  if (!key) return [{ label: '—', active: true }];
  const options = engineeringOptionsForKey(key);
  const current = String(poi?.[key] ?? '');
  return options.map((opt) => ({
    label: opt.label,
    active: opt.value === current,
  }));
}

function buildAnalysisAlternatives(item: AnalysisRow | undefined): MatrixCardAlternative[] {
  if (!item) return [{ label: 'Нет данных', active: true }];
  const st = item.status;
  if (st === 'not_required') return [{ label: 'Не требуется', active: true }];
  const activeLabel =
    st === 'construction_required'
      ? 'Объект не найден — строительство'
      : item.object_name || 'Ближайший объект';
  return [
    { label: activeLabel, active: true },
    { label: 'Строительство собственного', active: false },
  ];
}

function buildCardFooter(
  row: MatrixRow,
  cell: MatrixCell,
  item: AnalysisRow | undefined,
  poi: POI | undefined
): string {
  if (row.engineeringKey && poi) {
    return cell.text ? `Выбрано: ${cell.text}` : '';
  }
  if (item) {
    const parts: string[] = [];
    if (item.cost_mln != null && Number(item.cost_mln) > 0) parts.push(`${item.cost_mln} млн ₽`);
    parts.push(formatExternalDistanceBlock(item, []));
    const statusText = STATUS_LABELS[item.status] || item.status;
    if (statusText) parts.push(statusText);
    if (cell.subtext && !parts.includes(cell.subtext)) {
      parts.unshift(cell.subtext);
    }
    return parts.join(' · ') || cell.text;
  }
  if (cell.subtext) return `${cell.text} · ${cell.subtext}`;
  return cell.text;
}

export function buildMatrixCardModel(
  row: MatrixRow,
  colIndex: number,
  poi: POI | undefined,
  column: PoiColumnAnalysis
): MatrixCardModel {
  const cell = row.cells[colIndex] ?? { text: '—' };
  const item = findAnalysisItem(column, row);
  const alternatives = row.engineering
    ? buildEngineeringAlternatives(row, poi)
    : row.section === 'Точка интереса'
      ? [{ label: cell.text, active: true }]
      : buildAnalysisAlternatives(item);

  return {
    title: row.label,
    alternatives,
    footer: buildCardFooter(row, cell, item, poi),
    exceeds: cell.status === 'exceeds_limit' || item?.status === 'exceeds_limit',
  };
}

export function poiColumnHasExceed(column: PoiColumnAnalysis): boolean {
  return column.rows.some((r) => r.status === 'exceeds_limit');
}
