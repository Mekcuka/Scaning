import type {
  SandLogisticsConsumerRow,
  SandLogisticsQuarryRow,
  SandLogisticsResult,
  SandLogisticsSubnet,
} from '../api';
import { isInService } from '../infraEntryDate';
import { horizonYearRange, resolveViewTimelineStep, yearEndIso } from './viewTimeline';

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

export const UNMET_DEMAND_PREFIX = 'unmet_demand:';

/**
 * Предупреждения unmet_demand должны совпадать с demand_m3 / greedy_allocated_m3 на срезе.
 * Коды из канонической подсети (дата последнего расчёта) и одноразового greedy в API
 * иначе расходятся со схемой при смене года на шкале.
 */
export function reconcileSubnetWarningsForSlice(
  subnet: Pick<SandLogisticsSubnet, 'warnings' | 'consumers'>,
  options?: {
    timelineWarnings?: string[];
    canonicalWarnings?: string[];
  },
): string[] {
  const timelineOther = (options?.timelineWarnings ?? []).filter(
    (w) => !w.startsWith(UNMET_DEMAND_PREFIX),
  );
  const canonicalOther = (options?.canonicalWarnings ?? subnet.warnings).filter(
    (w) => !w.startsWith(UNMET_DEMAND_PREFIX),
  );
  const other = [...new Set([...timelineOther, ...canonicalOther])];

  const unmet: string[] = [];
  for (const c of subnet.consumers) {
    if (!c.in_service) continue;
    const demand = c.demand_m3 ?? 0;
    const allocated = c.greedy_allocated_m3 ?? 0;
    if (demand > allocated + 1e-6) {
      unmet.push(`${UNMET_DEMAND_PREFIX}${c.object_id}`);
    }
  }
  return [...other, ...unmet];
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

  const quarries = canonicalSubnet.quarries.map((q) =>
    mergeQuarryForSchematicAtView(q, quarryById.get(q.object_id), viewAsOf),
  );
  const consumers = canonicalSubnet.consumers.map((c) =>
    mergeConsumerForSchematicAtView(c, consumerById.get(c.object_id), viewAsOf),
  );

  return {
    ...canonicalSubnet,
    network_nodes: canonicalSubnet.network_nodes,
    network_edges: canonicalSubnet.network_edges,
    quarries,
    consumers,
    warnings: reconcileSubnetWarningsForSlice(
      { warnings: canonicalSubnet.warnings, consumers },
      {
        timelineWarnings: atViewSubnet?.warnings,
        canonicalWarnings: canonicalSubnet.warnings,
      },
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
