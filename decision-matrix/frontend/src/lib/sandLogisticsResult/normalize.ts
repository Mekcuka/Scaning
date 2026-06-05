import type {
  SandLogisticsConsumerRow,
  SandLogisticsProportionalPart,
  SandLogisticsQuarryRow,
  SandLogisticsResult,
  SandLogisticsSubnet,
  SandLogisticsYearStep,
} from '../api';
import { DEFAULT_ENTRY_DATE_ISO, todayIsoLocal } from '../infraEntryDate';

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
