import type {
  SandLogisticsConsumerRow,
  SandLogisticsQuarryRow,
  SandLogisticsResult,
  SandLogisticsSubnet,
} from './api';
import type { SandLogisticsLineStyle } from './sandLogisticsFlow';
import { DEFAULT_ENTRY_DATE_ISO, todayIsoLocal } from './infraEntryDate';

export function sandLogisticsStorageKey(projectId: string): string {
  return `sand-logistics:${projectId}`;
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
    entry_date: row.entry_date ?? DEFAULT_ENTRY_DATE_ISO,
    in_service: row.in_service !== false,
    nearest_quarry_id: row.nearest_quarry_id ?? null,
    nearest_quarry_name: row.nearest_quarry_name ?? null,
    distance_km: row.distance_km ?? null,
    snap_to_node_km: row.snap_to_node_km ?? null,
    greedy_quarry_id: row.greedy_quarry_id ?? null,
    greedy_quarry_name: row.greedy_quarry_name ?? null,
    greedy_allocated_m3: Number(row.greedy_allocated_m3) || 0,
    proportional_allocations: row.proportional_allocations ?? [],
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

  return {
    project_id: r.project_id ?? '',
    as_of: r.as_of ?? todayIsoLocal(),
    network_id: r.network_id ?? '',
    subnet_count: Number(r.subnet_count) || subnets.length,
    subnets,
    warnings: Array.isArray(r.warnings) ? r.warnings : [],
    object_names: objectNames,
  };
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

export function loadSandLogisticsFromSession(projectId: string): SandLogisticsResult | null {
  try {
    const raw = sessionStorage.getItem(sandLogisticsStorageKey(projectId));
    if (!raw) return null;
    return normalizeSandLogisticsResult(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSandLogisticsToSession(projectId: string, result: SandLogisticsResult): void {
  try {
    sessionStorage.setItem(sandLogisticsStorageKey(projectId), JSON.stringify(result));
  } catch {
    /* quota / private mode */
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
