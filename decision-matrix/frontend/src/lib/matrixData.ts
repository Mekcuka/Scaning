import {
  ANALYSIS_LINE_SUBTYPES,
  EXTERNAL_LINEAR_SUBTYPES,
  POINT_SUBTYPES,
  SUBTYPE_LABELS,
  type AnalysisRow,
  type POI,
} from './api';
import { formatExternalDistanceBlock } from './analysisDisplay';
import type { EngineeringParamKey } from './poiParams';

const INTERNAL_MATRIX_SUBTYPES = new Set<string>([...ANALYSIS_LINE_SUBTYPES, 'pads']);

/** Point subtypes in the comparison matrix (excludes connection nodes on the map). */
const MATRIX_POINT_SUBTYPES = POINT_SUBTYPES.filter((s) => s !== 'node');

export interface MatrixCell {
  text: string;
  /** Second line (internal rows: formula / detail), smaller type in matrix UI */
  subtext?: string;
  status?: string;
  badge?: boolean;
}

export interface MatrixRow {
  label: string;
  section: string;
  cells: MatrixCell[];
  total?: boolean;
  engineering?: boolean;
  /** POI field for inline engineering dropdowns in the matrix table */
  engineeringKey?: EngineeringParamKey;
  /** Analysis row key (card view) */
  subtype?: string;
  paramType?: string;
}

/** Row labels in the matrix (may differ from form section titles). */
const MATRIX_ENGINEERING_ROWS: { key: EngineeringParamKey; label: string }[] = [
  { key: 'eng_power', label: 'Электроснабжение' },
  { key: 'eng_injection', label: 'ППД' },
  { key: 'eng_gas', label: 'Обращение с газом' },
  { key: 'eng_oil_preparation', label: 'Подготовка нефти' },
  { key: 'eng_well_gathering', label: 'Сбор скважин' },
  { key: 'eng_transport', label: 'Транспорт' },
];

const ENGINEERING_LABELS: Record<string, Record<string, string>> = {
  eng_power: { external: 'Внешнее', internal: 'Внутреннее' },
  eng_injection: { centralized: 'Централиз.', local: 'Локальное', none: 'Нет' },
  eng_gas: { well: 'Факел/скважина', power_generation: 'Генерация', flare: 'Факел' },
  eng_oil_preparation: { mkos: 'МКОС', mfns: 'МФНС', ctp: 'ЦПС' },
  eng_well_gathering: { single_tube: 'Однотрубная', dual_tube: 'Двухтрубная' },
  eng_transport: { auto: 'Авто', marine: 'Морской', pipeline: 'Трубопровод' },
};

export function internalMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  const costMln = item.cost_mln;
  const text =
    costMln != null && costMln !== '' ? `${costMln} млн ₽` : '0 млн ₽';
  if (item.subtype === 'pads') {
    const n = item.pads_count;
    return { text, subtext: n != null ? `${n} шт.` : undefined };
  }
  const formula = item.formula_label as string | undefined;
  if (formula) return { text, subtext: formula };
  const dist = item.distance_km;
  return {
    text,
    subtext: dist != null && dist !== '' ? `${dist} км` : undefined,
  };
}

function isInternalMatrixItem(item: Record<string, unknown>): boolean {
  const paramType = String(item.param_type || '');
  const subtype = String(item.subtype || '');
  return paramType === 'internal' || INTERNAL_MATRIX_SUBTYPES.has(subtype);
}

function externalDistanceSubtext(item: Record<string, unknown>, extraParts: string[] = []): string {
  return formatExternalDistanceBlock(
    {
      distance_km: item.distance_km as number | string | null | undefined,
      limit_km: item.limit_km as number | string | null | undefined,
    },
    extraParts
  );
}

function externalCostSubtext(item: Record<string, unknown>): string {
  const costMln = item.cost_mln;
  if (costMln != null && costMln !== '' && Number(costMln) > 0) return `${costMln} млн ₽`;
  return '';
}

export function externalLinearMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  const st = String(item.status || '');
  if (st === 'not_required') return { text: 'Не треб.' };
  const cost = externalCostSubtext(item);
  const distBlock = externalDistanceSubtext(item, cost ? [cost] : []);
  if (st === 'construction_required') {
    return { text: 'Строительство', subtext: distBlock };
  }
  const name = item.object_name != null ? String(item.object_name).trim() : '';
  if (name) return { text: name, subtext: distBlock };
  const costMln = item.cost_mln;
  const text =
    costMln != null && costMln !== '' ? `${costMln} млн ₽` : '0 млн ₽';
  return { text, subtext: distBlock };
}

function findAnalysisRow(
  rows: AnalysisRow[],
  subtype: string,
  paramType: string
): AnalysisRow | undefined {
  return rows.find((a) => a.subtype === subtype && a.param_type === paramType);
}

function matrixCellFromAnalysisItem(item: AnalysisRow): MatrixCell {
  const raw = item as unknown as Record<string, unknown>;
  if (isInternalMatrixItem(raw)) {
    const { text, subtext } = internalMatrixCellParts(raw);
    return { text, subtext, status: item.status };
  }
  if (item.param_type === 'external_linear') {
    const { text, subtext } = externalLinearMatrixCellParts(raw);
    return { text, subtext, status: item.status };
  }
  const { text, subtext } = externalPointMatrixCellParts(raw);
  return { text, subtext, status: item.status };
}

export function externalPointMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  const st = String(item.status || '');
  if (st === 'not_required') return { text: 'Не треб.' };
  const name = item.object_name != null ? String(item.object_name).trim() : '';
  const cost = externalCostSubtext(item);
  const distBlock = externalDistanceSubtext(item, cost ? [cost] : []);

  if (st === 'construction_required') {
    return { text: name || 'Строительство', subtext: distBlock };
  }
  if (st === 'within_limit') {
    if (name) return { text: name, subtext: distBlock };
    return { text: 'В пределах', subtext: distBlock };
  }
  if (st === 'exceeds_limit') {
    if (name) return { text: name, subtext: distBlock };
    return { text: distBlock };
  }
  if (name) return { text: name, subtext: distBlock };
  return { text: distBlock };
}

export interface PoiColumnAnalysis {
  rows: AnalysisRow[];
  total_cost_mln: number | null;
}

export function resolvePoiColumnAnalysis(
  _poi: POI,
  live: { rows?: AnalysisRow[]; total_cost_mln?: number } | undefined
): PoiColumnAnalysis {
  if (live?.rows?.length) {
    return {
      rows: live.rows,
      total_cost_mln: live.total_cost_mln ?? null,
    };
  }
  return { rows: [], total_cost_mln: null };
}

/** Matrix columns = one per POI; cells from live analysis. */
export function buildMatrixRowsByPois(
  pois: POI[],
  columnAnalysis: PoiColumnAnalysis[]
): { rows: MatrixRow[]; columnNames: string[]; poisByColumn: POI[] } {
  const columnNames = pois.map((p) => p.name);
  const poisByColumn = pois;

  const sections: { key: string; subtypes: string[]; paramType: string }[] = [
    { key: 'Внутренние решения', subtypes: [...ANALYSIS_LINE_SUBTYPES, 'pads'], paramType: 'internal' },
    { key: 'Внешние линейные объекты', subtypes: [...EXTERNAL_LINEAR_SUBTYPES], paramType: 'external_linear' },
    { key: 'Внешние объекты', subtypes: [...MATRIX_POINT_SUBTYPES], paramType: 'external' },
  ];

  const rows: MatrixRow[] = [];

  for (const rowDef of MATRIX_ENGINEERING_ROWS) {
    rows.push({
      label: rowDef.label,
      section: 'Инженерные решения',
      engineering: true,
      engineeringKey: rowDef.key,
      cells: pois.map((poi) => {
        const raw = String((poi[rowDef.key] as string | undefined) || '—');
        const mapped = ENGINEERING_LABELS[rowDef.key]?.[raw] || raw;
        return { text: mapped, badge: true };
      }),
    });
  }

  for (const section of sections) {
    for (const subtype of section.subtypes) {
      const label = subtype === 'pads' ? 'Кустовые площадки' : SUBTYPE_LABELS[subtype] || subtype;
      const cells: MatrixCell[] = columnAnalysis.map((col) => {
        const item = findAnalysisRow(col.rows, subtype, section.paramType);
        if (!item) return { text: '—' };
        return matrixCellFromAnalysisItem(item);
      });
      rows.push({ label, section: section.key, cells, subtype, paramType: section.paramType });
    }
  }

  rows.push({
    label: 'Итого',
    section: 'Внешние объекты',
    total: true,
    cells: columnAnalysis.map((col) => ({
      text: col.total_cost_mln != null ? `${col.total_cost_mln} млн ₽` : '—',
    })),
  });

  return { rows, columnNames, poisByColumn };
}
