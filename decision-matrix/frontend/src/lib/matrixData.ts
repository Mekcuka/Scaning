import {
  ANALYSIS_LINE_SUBTYPES,
  EXTERNAL_LINEAR_SUBTYPES,
  POINT_SUBTYPES,
  SUBTYPE_LABELS,
  type AnalysisRow,
  type POI,
  type Scenario,
} from './api';
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

export function externalLinearMatrixCellParts(item: Record<string, unknown>): {
  text: string;
  subtext?: string;
} {
  const st = String(item.status || '');
  if (st === 'not_required') return { text: 'Не треб.' };
  if (st === 'construction_required') return { text: 'Строительство' };
  const costMln = item.cost_mln;
  const text =
    costMln != null && costMln !== '' ? `${costMln} млн ₽` : '0 млн ₽';
  const dist = item.distance_km;
  return {
    text,
    subtext: dist != null && dist !== '' ? `${dist} км` : undefined,
  };
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
  return { text: formatExternalMatrixCell(raw), status: item.status };
}

function formatExternalMatrixCell(item: Record<string, unknown>): string {

  const st = String(item.status || '');
  if (st === 'not_required') return 'Не треб.';
  if (st === 'construction_required') return 'Строительство';
  const dist = item.distance_km != null ? `${item.distance_km} км` : '';
  const cost = item.cost_mln != null ? `${item.cost_mln} млн ₽` : '';
  if (cost && dist) return `${cost} / ${dist}`;
  if (cost) return cost;
  if (dist) return dist;
  return st || '—';
}

export function analysisFromScenario(scenario: Scenario): AnalysisRow[] {
  const raw = scenario.results?.analysis;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      subtype: String(row.subtype || ''),
      param_type: String(row.param_type || 'external'),
      status: String(row.status || ''),
      distance_km: row.distance_km as number | null | undefined,
      limit_km: row.limit_km as number | undefined,
      object_name: row.object_name as string | null | undefined,
      anchor_lon: row.anchor_lon as number | null | undefined,
      anchor_lat: row.anchor_lat as number | null | undefined,
      anchor_type: row.anchor_type as string | null | undefined,
    };
  });
}

export function buildMatrixRows(
  scenarios: Scenario[],
  pois: POI[],
  fallbackNames: string[]
): { rows: MatrixRow[]; scenarioNames: string[]; poiByColumn: (POI | null)[] } {
  const cols = scenarios.length > 0 ? scenarios : fallbackNames.map((name, i) => ({
    id: String(i),
    name,
    scenario_type: 'base',
    is_manual: false,
    poi_id: pois[i]?.id ?? pois[0]?.id ?? null,
    results: null,
  })) as Scenario[];

  const scenarioNames = cols.map((s) => s.name);
  const poiByColumn = cols.map((s) => pois.find((p) => p.id === s.poi_id) ?? pois[0] ?? null);

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
      cells: cols.map((_, idx) => {
        const poi = poiByColumn[idx];
        const raw = String((poi?.[rowDef.key] as string | undefined) || '—');
        const mapped = ENGINEERING_LABELS[rowDef.key]?.[raw] || raw;
        return { text: mapped, badge: true };
      }),
    });
  }

  for (const section of sections) {
    for (const subtype of section.subtypes) {
      const label = subtype === 'pads' ? 'Кустовые площадки' : SUBTYPE_LABELS[subtype] || subtype;
      const cells: MatrixCell[] = cols.map((sc) => {
        const analysis = analysisFromScenario(sc);
        const item = findAnalysisRow(analysis, subtype, section.paramType);
        if (!item) {
          return { text: '—' };
        }
        return matrixCellFromAnalysisItem(item);
      });
      rows.push({ label, section: section.key, cells });
    }
  }

  const totalRow: MatrixRow = {
    label: 'Итого',
    section: 'Внешние объекты',
    total: true,
    cells: cols.map((sc) => {
      const t = sc.results?.total_cost_mln;
      return { text: t != null ? `${t} млн ₽` : '—' };
    }),
  };
  rows.push(totalRow);

  return { rows, scenarioNames, poiByColumn };
}

export interface PoiColumnAnalysis {
  rows: AnalysisRow[];
  total_cost_mln: number | null;
}

export function resolvePoiColumnAnalysis(
  poi: POI,
  live: { rows?: AnalysisRow[]; total_cost_mln?: number } | undefined,
  scenarios: Scenario[]
): PoiColumnAnalysis {
  if (live?.rows?.length) {
    return {
      rows: live.rows,
      total_cost_mln: live.total_cost_mln ?? null,
    };
  }
  const scenario = scenarios.find((s) => s.poi_id === poi.id && s.results?.analysis);
  if (scenario) {
    const rawTotal = scenario.results?.total_cost_mln;
    const total =
      typeof rawTotal === 'number' && Number.isFinite(rawTotal)
        ? rawTotal
        : rawTotal != null && Number.isFinite(Number(rawTotal))
          ? Number(rawTotal)
          : null;
    return {
      rows: analysisFromScenario(scenario),
      total_cost_mln: total,
    };
  }
  return { rows: [], total_cost_mln: null };
}

/** Matrix columns = one per POI; cells from live analysis or linked scenario. */
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
      rows.push({ label, section: section.key, cells });
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

export function connectionLinesForColumn(
  scenarios: Scenario[],
  colIndex: number,
  _pois: POI[],
  liveAnalysis: AnalysisRow[] | undefined
): AnalysisRow[] {
  const sc = scenarios[colIndex];
  if (sc?.results?.analysis) {
    return analysisFromScenario(sc);
  }
  return liveAnalysis ?? [];
}
