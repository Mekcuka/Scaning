import type { SandLogisticsResult, SandLogisticsSubnet } from '../api';
import { reconcileSubnetWarningsForSlice, UNMET_DEMAND_PREFIX } from './schematicSlice';
import { resolveSubnetsAtView } from './viewTimeline';

export const WARNING_OBJECT_PREFIXES: Record<string, string> = {
  unmet_demand: 'Неудовлетворённый спрос',
  no_path: 'Нет пути по автодорогам до карьера',
  not_in_service: 'Не введён в эксплуатацию',
  no_graph_node: 'Нет привязки к сети',
  too_far_from_autoroad: 'Дальше 300 м от автодороги',
  not_on_autoroad: 'Объект не на сети автодорог',
  not_in_quarry_subnet: 'Не связан с карьером по автодорогам',
  no_quarry_in_subnet: 'Подсеть без карьера (нет связи с карьером)',
};

export const GLOBAL_WARNING_LABELS: Record<string, string> = {
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

function isGlobalWarningCode(code: string): boolean {
  if (GLOBAL_WARNING_LABELS[code]) return true;
  return !code.includes(':');
}

/** Warnings for the amber «Общие предупреждения» block at a view date. */
export function collectSandLogisticsWarningsAtView(
  result: SandLogisticsResult,
  viewAsOf?: string,
): string[] {
  const sliceDate = viewAsOf ?? result.as_of;
  const persistedGlobal = result.warnings.filter(isGlobalWarningCode);

  const subnetsAtView = result.timeline.length
    ? resolveSubnetsAtView(result, sliceDate)
    : result.subnets;
  const fromSubnets = subnetsAtView.flatMap((subnet) =>
    reconcileSubnetWarningsForSlice(subnet),
  );

  if (result.timeline.length) {
    return [...new Set([...persistedGlobal, ...fromSubnets])];
  }

  const persistedStructural = result.warnings.filter(
    (code) => code.includes(':') && !code.startsWith(UNMET_DEMAND_PREFIX),
  );
  return [...new Set([...persistedGlobal, ...persistedStructural, ...fromSubnets])];
}

/** Group object-specific warnings; list object names instead of repeating generic text. */
export function buildGlobalSandLogisticsWarningLines(
  result: SandLogisticsResult,
  viewAsOf?: string,
): string[] {
  const nameById = collectNameMap(result.subnets, result.object_names);
  return warningLinesFromCodes(collectSandLogisticsWarningsAtView(result, viewAsOf), nameById);
}

export function buildSubnetSandLogisticsWarningLines(
  subnet: SandLogisticsSubnet,
  result: SandLogisticsResult
): string[] {
  const warnings = reconcileSubnetWarningsForSlice(subnet);
  if (!warnings.length) return [];
  const nameById = collectNameMap(result.subnets, result.object_names);
  return warningLinesFromCodes(warnings, nameById);
}

/** All warnings (global + per-subnet), merged for backward compatibility. */
export function buildSandLogisticsWarningLines(result: SandLogisticsResult): string[] {
  const lines = buildGlobalSandLogisticsWarningLines(result);
  for (const subnet of result.subnets) {
    lines.push(...buildSubnetSandLogisticsWarningLines(subnet, result));
  }
  return lines;
}
