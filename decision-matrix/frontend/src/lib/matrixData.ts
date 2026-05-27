import { LINE_SUBTYPES, POINT_SUBTYPES, SUBTYPE_LABELS, type AnalysisRow, type POI, type Scenario } from './api';

export interface MatrixCell {
  text: string;
  status?: string;
}

export interface MatrixRow {
  label: string;
  section: string;
  cells: MatrixCell[];
  total?: boolean;
}

function formatItem(item: Record<string, unknown>): string {
  const st = String(item.status || '');
  if (st === 'not_required') return 'Не треб.';
  if (st === 'construction_required') return 'Строительство';
  const dist = item.distance_km != null ? `${item.distance_km} км` : '';
  const cost = item.cost_mln != null ? `${item.cost_mln} млн ₽` : '';
  if (cost && dist) return `${cost} / ${dist}`;
  if (cost) return cost;
  if (dist) return dist;
  if (item.pads_count != null) return `${item.pads_count} шт.`;
  return st || '—';
}

function analysisFromScenario(scenario: Scenario): AnalysisRow[] {
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

  const sections: { key: string; subtypes: string[] }[] = [
    { key: 'Внутренние решения', subtypes: [...LINE_SUBTYPES, 'pads'] },
    { key: 'Внешние объекты', subtypes: [...POINT_SUBTYPES] },
  ];

  const rows: MatrixRow[] = [];

  for (const section of sections) {
    for (const subtype of section.subtypes) {
      const label = subtype === 'pads' ? 'Кустовые площадки' : SUBTYPE_LABELS[subtype] || subtype;
      const cells: MatrixCell[] = cols.map((sc) => {
        const analysis = analysisFromScenario(sc);
        const item = analysis.find((a) => a.subtype === subtype);
        if (!item) {
          return { text: '—' };
        }
        const raw = sc.results?.analysis as Record<string, unknown>[] | undefined;
        const full = raw?.find((r) => r.subtype === subtype) as Record<string, unknown> | undefined;
        return {
          text: full ? formatItem(full) : formatItem(item as unknown as Record<string, unknown>),
          status: item.status,
        };
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
