import type {
  SandLogisticsConsumerRow,
  SandLogisticsProportionalPart,
  SandLogisticsQuarryRow,
  SandLogisticsResult,
  SandLogisticsSubnet,
  SandLogisticsYearStep,
} from './api';
import type {
  SandLogisticsEdgeLabelMode,
  SandLogisticsLineStyle,
  SandLogisticsNodeFilterMode,
} from './sandLogisticsFlow';
import { DEFAULT_ENTRY_DATE_ISO, isInService, todayIsoLocal } from './infraEntryDate';

export function sandLogisticsStorageKey(projectId: string): string {
  return `sand-logistics:${projectId}`;
}

function normalizeProportionalPart(
  row: Partial<SandLogisticsProportionalPart>,
): SandLogisticsProportionalPart {
  return {
    quarry_id: row.quarry_id ?? '',
    quarry_name: row.quarry_name ?? '',
    allocated_m3: Number(row.allocated_m3) || 0,
    distance_km: row.distance_km ?? null,
  };
}

function normalizeConsumer(row: Partial<SandLogisticsConsumerRow>): SandLogisticsConsumerRow {
  return {
    object_id: row.object_id ?? '',
    name: row.name ?? '',
    subtype: row.subtype ?? '',
    lon: Number(row.lon) || 0,
    lat: Number(row.lat) || 0,
    snap_node_id: row.snap_node_id ?? null,
    demand_m3: Number(row.demand_m3) || 0,
    demand_plan_total_m3: Number(row.demand_plan_total_m3) || Number(row.demand_m3) || 0,
    demand_by_year_m3:
      row.demand_by_year_m3 && typeof row.demand_by_year_m3 === 'object'
        ? Object.fromEntries(
            Object.entries(row.demand_by_year_m3).map(([y, v]) => [y, Number(v) || 0]),
          )
        : {},
    entry_date: row.entry_date ?? DEFAULT_ENTRY_DATE_ISO,
    in_service: row.in_service !== false,
    nearest_quarry_id: row.nearest_quarry_id ?? null,
    nearest_quarry_name: row.nearest_quarry_name ?? null,
    distance_km: row.distance_km ?? null,
    snap_to_node_km: row.snap_to_node_km ?? null,
    distances_to_quarries_km: row.distances_to_quarries_km ?? {},
    greedy_quarry_id: row.greedy_quarry_id ?? null,
    greedy_quarry_name: row.greedy_quarry_name ?? null,
    greedy_allocated_m3: Number(row.greedy_allocated_m3) || 0,
    allocation_by_year_m3:
      row.allocation_by_year_m3 && typeof row.allocation_by_year_m3 === 'object'
        ? Object.fromEntries(
            Object.entries(row.allocation_by_year_m3).map(([y, v]) => [y, Number(v) || 0]),
          )
        : {},
    proportional_allocations: Array.isArray(row.proportional_allocations)
      ? row.proportional_allocations.map((p) =>
          normalizeProportionalPart(p as Partial<SandLogisticsProportionalPart>),
        )
      : [],
  };
}

function normalizeQuarry(row: Partial<SandLogisticsQuarryRow>): SandLogisticsQuarryRow {
  return {
    object_id: row.object_id ?? '',
    name: row.name ?? '',
    lon: Number(row.lon) || 0,
    lat: Number(row.lat) || 0,
    snap_node_id: row.snap_node_id ?? null,
    entry_date: row.entry_date ?? DEFAULT_ENTRY_DATE_ISO,
    in_service: row.in_service !== false,
    initial_m3: Number(row.initial_m3) || 0,
    current_m3: Number(row.current_m3) || 0,
    greedy_allocated_m3: Number(row.greedy_allocated_m3) || 0,
    greedy_remaining_m3: Number(row.greedy_remaining_m3) || 0,
    proportional_allocated_m3: Number(row.proportional_allocated_m3) || 0,
    proportional_exceeds_capacity: Boolean(row.proportional_exceeds_capacity),
  };
}

function normalizeSubnet(row: Partial<SandLogisticsSubnet>, index: number): SandLogisticsSubnet {
  return {
    subnet_index: Number(row.subnet_index) || index,
    name: row.name ?? `Подсеть ${index}`,
    autoroad_edge_count: Number(row.autoroad_edge_count) || 0,
    quarry_count: Number(row.quarry_count) || 0,
    consumer_count: Number(row.consumer_count) || 0,
    network_nodes: Array.isArray(row.network_nodes) ? row.network_nodes : [],
    network_edges: Array.isArray(row.network_edges) ? row.network_edges : [],
    quarries: Array.isArray(row.quarries) ? row.quarries.map(normalizeQuarry) : [],
    consumers: Array.isArray(row.consumers) ? row.consumers.map(normalizeConsumer) : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
  };
}

function normalizeYearStep(row: Partial<SandLogisticsYearStep>, index: number): SandLogisticsYearStep {
  return {
    year: Number(row.year) || index,
    as_of: row.as_of ?? todayIsoLocal(),
    subnet_count: Number(row.subnet_count) || 0,
    total_demand_m3: Number(row.total_demand_m3) || 0,
    total_allocated_m3: Number(row.total_allocated_m3) || 0,
    unmet_m3: Number(row.unmet_m3) || 0,
    subnets: Array.isArray(row.subnets) ? row.subnets.map((s, i) => normalizeSubnet(s, i + 1)) : [],
  };
}

/** Normalize API payload and guard against missing fields (prevents render crashes). */
export function normalizeSandLogisticsResult(raw: unknown): SandLogisticsResult {
  const r = (raw ?? {}) as Partial<SandLogisticsResult> & {
    quarries?: SandLogisticsQuarryRow[];
    consumers?: SandLogisticsConsumerRow[];
    network_nodes?: SandLogisticsSubnet['network_nodes'];
    network_edges?: SandLogisticsSubnet['network_edges'];
    autoroad_edge_count?: number;
    quarry_count?: number;
    consumer_count?: number;
  };

  let subnets: SandLogisticsSubnet[];
  if (Array.isArray(r.subnets) && r.subnets.length > 0) {
    subnets = r.subnets.map((s, i) => normalizeSubnet(s, i + 1));
  } else if (
    (Array.isArray(r.quarries) && r.quarries.length > 0) ||
    (Array.isArray(r.consumers) && r.consumers.length > 0)
  ) {
    subnets = [
      normalizeSubnet(
        {
          subnet_index: 1,
          name: 'Подсеть 1',
          autoroad_edge_count: r.autoroad_edge_count,
          quarry_count: r.quarry_count,
          consumer_count: r.consumer_count,
          network_nodes: r.network_nodes,
          network_edges: r.network_edges,
          quarries: r.quarries,
          consumers: r.consumers,
          warnings: [],
        },
        1
      ),
    ];
  } else {
    subnets = [];
  }

  const objectNames: Record<string, string> = { ...(r.object_names ?? {}) };
  for (const subnet of subnets) {
    for (const q of subnet.quarries) {
      if (q.name?.trim()) objectNames[q.object_id] = q.name.trim();
    }
    for (const c of subnet.consumers) {
      if (c.name?.trim()) objectNames[c.object_id] = c.name.trim();
    }
  }

  const asOf = r.as_of ?? todayIsoLocal();
  const horizonFrom = r.horizon_from ?? asOf;
  const horizonTo = r.horizon_to ?? asOf;
  const timeline = Array.isArray(r.timeline)
    ? r.timeline.map((step, i) => normalizeYearStep(step as Partial<SandLogisticsYearStep>, i))
    : [];

  return {
    project_id: r.project_id ?? '',
    horizon_from: horizonFrom,
    horizon_to: horizonTo,
    as_of: asOf,
    network_id: r.network_id ?? '',
    subnet_count: Number(r.subnet_count) || subnets.length,
    subnets,
    timeline,
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    object_names: objectNames,
    calculated_at: r.calculated_at ?? null,
  };
}

/** Subnets for schematic/tables at a view date (from timeline or fallback). */
export function resolveSubnetsAtView(
  result: SandLogisticsResult,
  viewAsOf: string,
): SandLogisticsSubnet[] {
  if (!result.timeline.length) return result.subnets;
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  const step =
    result.timeline.find((t) => t.as_of === viewAsOf) ??
    result.timeline.find((t) => t.year === viewYear);
  if (step?.subnets.length) return step.subnets;
  return result.subnets;
}

/** Timeline step for a view date, if the result has a horizon timeline. */
export function resolveViewTimelineStep(
  result: SandLogisticsResult,
  viewAsOf: string,
): SandLogisticsYearStep | null {
  if (!result.timeline.length) return null;
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  return (
    result.timeline.find((t) => t.as_of === viewAsOf) ??
    result.timeline.find((t) => t.year === viewYear) ??
    null
  );
}

function mergeQuarryForSchematicAtView(
  canonical: SandLogisticsQuarryRow,
  atView: SandLogisticsQuarryRow | undefined,
  viewAsOf: string,
): SandLogisticsQuarryRow {
  const inServiceAtView = isInService(canonical.entry_date, viewAsOf);
  if (!inServiceAtView) {
    return {
      ...canonical,
      in_service: false,
      greedy_allocated_m3: 0,
      greedy_remaining_m3: 0,
    };
  }
  if (atView) {
    return {
      ...canonical,
      ...atView,
      snap_node_id: canonical.snap_node_id ?? atView.snap_node_id,
      lon: canonical.lon,
      lat: canonical.lat,
      entry_date: canonical.entry_date,
      in_service: true,
    };
  }
  return {
    ...canonical,
    in_service: true,
    greedy_allocated_m3: 0,
    greedy_remaining_m3: canonical.initial_m3,
  };
}

function mergeConsumerForSchematicAtView(
  canonical: SandLogisticsConsumerRow,
  atView: SandLogisticsConsumerRow | undefined,
  viewAsOf: string,
): SandLogisticsConsumerRow {
  const inServiceAtView = isInService(canonical.entry_date, viewAsOf);
  if (!inServiceAtView) {
    return {
      ...canonical,
      in_service: false,
      demand_m3: 0,
      greedy_allocated_m3: 0,
      greedy_quarry_id: null,
      greedy_quarry_name: null,
    };
  }
  if (atView) {
    return {
      ...canonical,
      ...atView,
      snap_node_id: canonical.snap_node_id ?? atView.snap_node_id,
      lon: canonical.lon,
      lat: canonical.lat,
      entry_date: canonical.entry_date,
      in_service: true,
    };
  }
  return {
    ...canonical,
    in_service: true,
    demand_m3: 0,
    greedy_allocated_m3: 0,
    greedy_quarry_id: null,
    greedy_quarry_name: null,
  };
}

/**
 * Полная топология подсети (как в финальном расчёте) с объёмами и in_service на дату среза.
 * Не введённые к срезу объекты остаются на схеме (серые), с нулевыми отгрузками.
 */
let schematicSliceCacheResult: SandLogisticsResult | null = null;
const schematicSliceCache = new Map<string, SandLogisticsSubnet>();

function schematicSliceCacheKey(subnetIndex: number, viewAsOf: string): string {
  return `${subnetIndex}|${viewAsOf}`;
}

export function clearSchematicSliceCache(): void {
  schematicSliceCache.clear();
  schematicSliceCacheResult = null;
}

function buildSubnetForSchematicAtView(
  result: SandLogisticsResult,
  canonicalSubnet: SandLogisticsSubnet,
  viewAsOf: string,
): SandLogisticsSubnet {
  const step = resolveViewTimelineStep(result, viewAsOf);
  const atViewSubnet = step?.subnets.find((s) => s.subnet_index === canonicalSubnet.subnet_index);
  const quarryById = new Map((atViewSubnet?.quarries ?? []).map((q) => [q.object_id, q]));
  const consumerById = new Map((atViewSubnet?.consumers ?? []).map((c) => [c.object_id, c]));

  return {
    ...canonicalSubnet,
    network_nodes: canonicalSubnet.network_nodes,
    network_edges: canonicalSubnet.network_edges,
    quarries: canonicalSubnet.quarries.map((q) =>
      mergeQuarryForSchematicAtView(q, quarryById.get(q.object_id), viewAsOf),
    ),
    consumers: canonicalSubnet.consumers.map((c) =>
      mergeConsumerForSchematicAtView(c, consumerById.get(c.object_id), viewAsOf),
    ),
  };
}

export function resolveSubnetForSchematicAtView(
  result: SandLogisticsResult,
  canonicalSubnet: SandLogisticsSubnet,
  viewAsOf: string,
): SandLogisticsSubnet {
  if (schematicSliceCacheResult !== result) {
    schematicSliceCache.clear();
    schematicSliceCacheResult = result;
  }
  const cacheKey = schematicSliceCacheKey(canonicalSubnet.subnet_index, viewAsOf);
  const cached = schematicSliceCache.get(cacheKey);
  if (cached) return cached;

  const merged = buildSubnetForSchematicAtView(result, canonicalSubnet, viewAsOf);
  schematicSliceCache.set(cacheKey, merged);
  return merged;
}

/** Прогревает кэш slice-подсетей для всех годов горизонта (requestIdleCallback). */
export function prefetchSchematicSubnetsAtView(result: SandLogisticsResult): void {
  if (!result.timeline.length) return;

  const run = () => {
    for (const year of horizonYearRange(result)) {
      const viewAsOf = yearEndIso(year);
      for (const canonical of result.subnets) {
        resolveSubnetForSchematicAtView(result, canonical, viewAsOf);
      }
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run);
  } else {
    setTimeout(run, 0);
  }
}

export function horizonYearRange(result: SandLogisticsResult): number[] {
  const fromYear = Number.parseInt(result.horizon_from.slice(0, 4), 10);
  const toYear = Number.parseInt(result.horizon_to.slice(0, 4), 10);
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return [];
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y += 1) years.push(y);
  return years;
}

export function yearEndIso(year: number): string {
  return `${year}-12-31`;
}

export function withInfraObjectNames(
  result: SandLogisticsResult,
  infra: { id: string; name: string }[]
): SandLogisticsResult {
  const object_names = { ...result.object_names };
  for (const o of infra) {
    const trimmed = o.name?.trim();
    if (trimmed) object_names[o.id] = trimmed;
  }
  return { ...result, object_names };
}

/** Legacy sessionStorage payload (pre-DB persist); for migration banner only. */
export function hasLegacySandLogisticsSession(projectId: string): boolean {
  try {
    return sessionStorage.getItem(sandLogisticsStorageKey(projectId)) != null;
  } catch {
    return false;
  }
}

export function clearLegacySandLogisticsSession(projectId: string): void {
  try {
    sessionStorage.removeItem(sandLogisticsStorageKey(projectId));
  } catch {
    /* ignore */
  }
}

const WARNING_OBJECT_PREFIXES: Record<string, string> = {
  unmet_demand: 'Неудовлетворённый спрос',
  no_path: 'Нет пути по автодорогам до карьера',
  not_in_service: 'Не введён в эксплуатацию',
  no_graph_node: 'Нет привязки к сети',
  too_far_from_autoroad: 'Дальше 300 м от автодороги',
  not_on_autoroad: 'Объект не на сети автодорог',
  not_in_quarry_subnet: 'Не связан с карьером по автодорогам',
  no_quarry_in_subnet: 'Подсеть без карьера (нет связи с карьером)',
};

const GLOBAL_WARNING_LABELS: Record<string, string> = {
  no_autoroad_network: 'В сети нет рёбер автодорог — постройте сеть на карте',
  no_autoroad_edges: 'В сети нет рёбер автодорог',
  no_network: 'Сеть не построена',
  no_sand_quarries: 'На карте нет карьеров песка',
  no_sand_consumers: 'Нет потребителей с объёмом спроса',
  no_connected_quarry_subnets: 'Нет связных подсетей с карьерами и автодорогами',
};

function collectNameMap(
  subnets: SandLogisticsSubnet[],
  objectNames?: Record<string, string>
): Map<string, string> {
  const nameById = new Map<string, string>();
  if (objectNames) {
    for (const [id, name] of Object.entries(objectNames)) {
      const trimmed = name?.trim();
      if (trimmed) nameById.set(id, trimmed);
    }
  }
  for (const subnet of subnets) {
    for (const q of subnet.quarries) {
      if (q.name?.trim()) nameById.set(q.object_id, q.name.trim());
    }
    for (const c of subnet.consumers) {
      const label = c.name?.trim() || c.subtype || 'Объект';
      nameById.set(c.object_id, label);
    }
  }
  return nameById;
}

function objectDisplayName(nameById: Map<string, string>, objectId: string): string {
  return nameById.get(objectId) ?? 'Объект без названия';
}

function warningLinesFromCodes(
  codes: string[],
  nameById: Map<string, string>,
  subnetLabel?: string
): string[] {
  const objectGroups = new Map<string, string[]>();
  const global: string[] = [];
  const prefix = subnetLabel ? `${subnetLabel}: ` : '';

  for (const code of codes) {
    const globalLabel = GLOBAL_WARNING_LABELS[code];
    if (globalLabel) {
      const line = prefix + globalLabel;
      if (!global.includes(line)) global.push(line);
      continue;
    }

    const colon = code.indexOf(':');
    if (colon < 0) {
      const line = prefix + code;
      if (!global.includes(line)) global.push(line);
      continue;
    }

    const key = code.slice(0, colon);
    const objectId = code.slice(colon + 1);
    const title = WARNING_OBJECT_PREFIXES[key];
    if (!title || !objectId) {
      const line = prefix + code;
      if (!global.includes(line)) global.push(line);
      continue;
    }

    const label = objectDisplayName(nameById, objectId);
    const groupKey = subnetLabel ? `${subnetLabel}|${key}` : key;
    const list = objectGroups.get(groupKey) ?? [];
    if (!list.includes(label)) list.push(label);
    objectGroups.set(groupKey, list);
  }

  const lines: string[] = [...global];

  for (const [groupKey, names] of objectGroups) {
    const key = groupKey.includes('|') ? groupKey.split('|').pop()! : groupKey;
    const title = WARNING_OBJECT_PREFIXES[key];
    if (!title || !names.length) continue;
    const sub = groupKey.includes('|') ? `${groupKey.split('|')[0]}: ` : '';
    names.sort((a, b) => a.localeCompare(b, 'ru'));
    lines.push(`${sub}${title}: ${names.join(', ')}`);
  }

  return lines;
}

/** Group object-specific warnings; list object names instead of repeating generic text. */
export function buildGlobalSandLogisticsWarningLines(result: SandLogisticsResult): string[] {
  const nameById = collectNameMap(result.subnets, result.object_names);
  return warningLinesFromCodes(result.warnings, nameById);
}

export function buildSubnetSandLogisticsWarningLines(
  subnet: SandLogisticsSubnet,
  result: SandLogisticsResult
): string[] {
  if (!subnet.warnings.length) return [];
  const nameById = collectNameMap(result.subnets, result.object_names);
  return warningLinesFromCodes(subnet.warnings, nameById);
}

/** All warnings (global + per-subnet), merged for backward compatibility. */
export function buildSandLogisticsWarningLines(result: SandLogisticsResult): string[] {
  const lines = buildGlobalSandLogisticsWarningLines(result);
  for (const subnet of result.subnets) {
    lines.push(...buildSubnetSandLogisticsWarningLines(subnet, result));
  }
  return lines;
}

export function activeSubnetStorageKey(projectId: string): string {
  return `sand-logistics:active-subnet:${projectId}`;
}

export function loadActiveSubnetIndex(projectId: string, maxIndex: number): number {
  try {
    const raw = sessionStorage.getItem(activeSubnetStorageKey(projectId));
    const n = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0 || n > maxIndex) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function saveActiveSubnetIndex(projectId: string, index: number): void {
  try {
    sessionStorage.setItem(activeSubnetStorageKey(projectId), String(index));
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsLineStyleKey(projectId: string): string {
  return `sand-logistics:line-style:${projectId}`;
}

const VALID_LINE_STYLES = new Set<SandLogisticsLineStyle>(['straight', 'bezier', 'smoothstep']);

export function loadSandLogisticsLineStyle(projectId: string): SandLogisticsLineStyle {
  try {
    const raw = sessionStorage.getItem(sandLogisticsLineStyleKey(projectId));
    if (raw && VALID_LINE_STYLES.has(raw as SandLogisticsLineStyle)) {
      return raw as SandLogisticsLineStyle;
    }
  } catch {
    /* ignore */
  }
  return 'straight';
}

export function saveSandLogisticsLineStyle(
  projectId: string,
  style: SandLogisticsLineStyle
): void {
  try {
    sessionStorage.setItem(sandLogisticsLineStyleKey(projectId), style);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsEdgeLabelModeKey(projectId: string): string {
  return `sand-logistics:edge-labels:${projectId}`;
}

const VALID_EDGE_LABEL_MODES = new Set<SandLogisticsEdgeLabelMode>(['all', 'key', 'hidden']);

export function loadSandLogisticsEdgeLabelMode(projectId: string): SandLogisticsEdgeLabelMode {
  try {
    const raw = sessionStorage.getItem(sandLogisticsEdgeLabelModeKey(projectId));
    if (raw && VALID_EDGE_LABEL_MODES.has(raw as SandLogisticsEdgeLabelMode)) {
      return raw as SandLogisticsEdgeLabelMode;
    }
  } catch {
    /* ignore */
  }
  return 'key';
}

export function saveSandLogisticsEdgeLabelMode(
  projectId: string,
  mode: SandLogisticsEdgeLabelMode
): void {
  try {
    sessionStorage.setItem(sandLogisticsEdgeLabelModeKey(projectId), mode);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsHorizonToKey(projectId: string): string {
  return `sand-logistics-horizon-to:${projectId}`;
}

export function loadSandLogisticsHorizonTo(projectId: string): string | null {
  try {
    const raw = sessionStorage.getItem(sandLogisticsHorizonToKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSandLogisticsHorizonTo(projectId: string, horizonTo: string): void {
  try {
    sessionStorage.setItem(sandLogisticsHorizonToKey(projectId), horizonTo);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsViewAsOfKey(projectId: string): string {
  return `sand-logistics-view-as-of:${projectId}`;
}

export function loadSandLogisticsViewAsOf(projectId: string, fallback: string): string {
  try {
    const raw = sessionStorage.getItem(sandLogisticsViewAsOfKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveSandLogisticsViewAsOf(projectId: string, viewAsOf: string): void {
  try {
    sessionStorage.setItem(sandLogisticsViewAsOfKey(projectId), viewAsOf);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsAsOfKey(projectId: string): string {
  return `sand-logistics-as-of:${projectId}`;
}

export function loadSandLogisticsAsOf(projectId: string): string {
  try {
    const raw = sessionStorage.getItem(sandLogisticsAsOfKey(projectId));
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return todayIsoLocal();
}

export function saveSandLogisticsAsOf(projectId: string, asOf: string): void {
  try {
    sessionStorage.setItem(sandLogisticsAsOfKey(projectId), asOf);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsNodeFilterKey(projectId: string): string {
  return `sand-logistics:node-filter:${projectId}`;
}

const VALID_NODE_FILTERS = new Set<SandLogisticsNodeFilterMode>([
  'all_planned',
  'in_service',
  'allocated_only',
]);

export function loadSandLogisticsNodeFilterMode(projectId: string): SandLogisticsNodeFilterMode {
  try {
    const raw = sessionStorage.getItem(sandLogisticsNodeFilterKey(projectId));
    if (raw && VALID_NODE_FILTERS.has(raw as SandLogisticsNodeFilterMode)) {
      return raw as SandLogisticsNodeFilterMode;
    }
  } catch {
    /* ignore */
  }
  return 'all_planned';
}

export function saveSandLogisticsNodeFilterMode(
  projectId: string,
  mode: SandLogisticsNodeFilterMode,
): void {
  try {
    sessionStorage.setItem(sandLogisticsNodeFilterKey(projectId), mode);
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsShowPlannedRoutesKey(projectId: string): string {
  return `sand-logistics:planned-routes:${projectId}`;
}

export function loadSandLogisticsShowPlannedRoutes(projectId: string): boolean {
  try {
    const raw = sessionStorage.getItem(sandLogisticsShowPlannedRoutesKey(projectId));
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveSandLogisticsShowPlannedRoutes(projectId: string, value: boolean): void {
  try {
    sessionStorage.setItem(sandLogisticsShowPlannedRoutesKey(projectId), value ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}

export function sandLogisticsGroupByEntryYearKey(projectId: string): string {
  return `sand-logistics:group-by-year:${projectId}`;
}

export function loadSandLogisticsGroupByEntryYear(projectId: string): boolean {
  try {
    return sessionStorage.getItem(sandLogisticsGroupByEntryYearKey(projectId)) === '1';
  } catch {
    /* ignore */
  }
  return false;
}

export function saveSandLogisticsGroupByEntryYear(projectId: string, value: boolean): void {
  try {
    sessionStorage.setItem(sandLogisticsGroupByEntryYearKey(projectId), value ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}
