export interface SandLogisticsNetworkNode {
  id: string;
  lon: number;
  lat: number;
}

export interface SandLogisticsNetworkEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  length_km: number;
}

export interface SandLogisticsProportionalPart {
  quarry_id: string;
  quarry_name: string;
  allocated_m3: number;
  distance_km: number | null;
}

export interface SandLogisticsQuarryRow {
  object_id: string;
  name: string;
  lon: number;
  lat: number;
  snap_node_id?: string | null;
  entry_date: string;
  in_service: boolean;
  initial_m3: number;
  current_m3: number;
  greedy_allocated_m3: number;
  greedy_remaining_m3: number;
  proportional_allocated_m3: number;
  proportional_exceeds_capacity: boolean;
}

export interface SandLogisticsConsumerRow {
  object_id: string;
  name: string;
  subtype: string;
  lon: number;
  lat: number;
  snap_node_id?: string | null;
  demand_m3: number;
  demand_plan_total_m3?: number;
  demand_by_year_m3?: Record<string, number>;
  entry_date: string;
  in_service: boolean;
  nearest_quarry_id: string | null;
  nearest_quarry_name: string | null;
  distance_km: number | null;
  snap_to_node_km: number | null;
  distances_to_quarries_km?: Record<string, number | null>;
  greedy_quarry_id: string | null;
  greedy_quarry_name: string | null;
  greedy_allocated_m3: number;
  allocation_by_year_m3?: Record<string, number>;
  proportional_allocations: SandLogisticsProportionalPart[];
}

export interface SandLogisticsYearStep {
  year: number;
  as_of: string;
  subnet_count: number;
  total_demand_m3: number;
  total_allocated_m3: number;
  unmet_m3: number;
  subnets: SandLogisticsSubnet[];
}

export interface SandLogisticsSubnet {
  subnet_index: number;
  name: string;
  autoroad_edge_count: number;
  quarry_count: number;
  consumer_count: number;
  network_nodes: SandLogisticsNetworkNode[];
  network_edges: SandLogisticsNetworkEdge[];
  quarries: SandLogisticsQuarryRow[];
  consumers: SandLogisticsConsumerRow[];
  warnings: string[];
}

export interface SandLogisticsResult {
  project_id: string;
  horizon_from: string;
  horizon_to: string;
  as_of: string;
  network_id: string;
  subnet_count: number;
  subnets: SandLogisticsSubnet[];
  timeline: SandLogisticsYearStep[];
  warnings: string[];
  /** Имена всех карьеров/потребителей (в т.ч. вне подсетей) для подписей предупреждений */
  object_names: Record<string, string>;
  /** ISO datetime when analysis was last saved to the project */
  calculated_at?: string | null;
}
