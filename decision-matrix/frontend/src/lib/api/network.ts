export interface PlanTerminalInput {
  id: string;
  subtype: string;
  name: string;
  lon: number;
  lat: number;
  category?: string;
  subtype_label?: string;
  properties?: Record<string, unknown>;
  coordinates?: [number, number];
}

export interface ExistingAutoroadInput {
  id: string;
  coordinates: number[][];
  name?: string;
  subtype?: string;
}

export interface NetworkPlanRequest {
  project_id: string;
  terminals: PlanTerminalInput[];
  existing_autoroads: ExistingAutoroadInput[];
  options?: {
    solver?: 'geosteiner' | 'steinerpy';
    connector_max_km?: number;
    enforce_attachment_radius?: boolean;
    normalize_terminal_leaves?: boolean;
    steiner_hub_prefix?: string;
    steiner_hub_offset_km?: number;
    edge_vertex_spacing_km?: number;
    steiner_radius_km?: number;
    attachment_angle_deg?: number;
    attachment_angle_penalty?: number;
    snap_tolerance_km?: number;
    node_dedup_km?: number;
    max_terminals?: number;
  };
}

export interface PlanTerminalResult {
  id: string;
  name: string;
  subtype?: string;
  category?: string;
  subtype_label?: string;
  lon?: number;
  lat?: number;
  coordinates?: [number, number];
  properties?: Record<string, unknown>;
  warning?: string | null;
  snap_lon?: number | null;
  snap_lat?: number | null;
  graph_attached?: boolean;
  graph_node_id?: string | null;
}

export interface PlannedLineOut {
  kind: string;
  coordinates: number[][];
  snap_start_object_id?: string | null;
  snap_finish_object_id?: string | null;
}

export interface NetworkPlanResponse {
  terminals: PlanTerminalResult[];
  new_lines: PlannedLineOut[];
  new_nodes: { lon: number; lat: number; reason: string }[];
  splits: {
    line_id: string;
    segment_index: number;
    split_lon: number;
    split_lat: number;
  }[];
  used_existing_edge_ids: string[];
  total_new_km: number;
  warnings: string[];
  preview?: { type: string; features: unknown[] } | null;
  request_meta?: {
    project_id?: string;
    terminal_count?: number;
    existing_road_count?: number;
  } | null;
  new_line_count: number;
  new_node_count: number;
  split_count: number;
}

export interface AutoroadNetworkApplyResult {
  plan: NetworkPlanResponse;
  created_node_ids: string[];
  created_line_ids: string[];
  created_nodes: number;
  created_lines: number;
}

export interface AutoroadConnectResult {
  dry_run: boolean;
  terminals: {
    object_id: string;
    name?: string;
    graph_node_id?: string | null;
    warning?: string | null;
  }[];
  new_line_count: number;
  new_node_count: number;
  split_count: number;
  used_existing_edge_ids: string[];
  total_new_km: number;
  warnings: string[];
  preview?: { type: string; features: unknown[] } | null;
  created_node_ids: string[];
  created_line_ids: string[];
  created_nodes: number;
  created_lines: number;
}
