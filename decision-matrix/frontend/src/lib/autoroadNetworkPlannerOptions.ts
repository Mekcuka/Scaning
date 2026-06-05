/** Planner options for autoroad network (persisted per project). */

export type AutoroadPlannerSolver = 'geosteiner' | 'steinerpy';

export type AutoroadPlannerParamScope = 'both' | 'steinerpy' | 'geosteiner';

export type AutoroadPlannerOptions = {
  solver: AutoroadPlannerSolver;
  connector_max_km: number;
  enforce_attachment_radius: boolean;
  normalize_terminal_leaves: boolean;
  steiner_hub_prefix: string;
  steiner_hub_offset_km: number;
  edge_vertex_spacing_km: number;
  steiner_radius_km: number;
  attachment_angle_deg: number;
  attachment_angle_penalty: number;
  param_scope: AutoroadPlannerParamScope;
};

export const DEFAULT_AUTOROAD_PLANNER_OPTIONS: AutoroadPlannerOptions = {
  solver: 'geosteiner',
  connector_max_km: 0.2,
  enforce_attachment_radius: true,
  normalize_terminal_leaves: true,
  steiner_hub_prefix: 'steiner:hub',
  steiner_hub_offset_km: 0,
  edge_vertex_spacing_km: 0,
  steiner_radius_km: 0.2,
  attachment_angle_deg: 90,
  attachment_angle_penalty: 0,
  param_scope: 'both',
};

const STORAGE_PREFIX = 'dm-autoroad-planner-opts:';

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadAutoroadPlannerOptions(projectId: string | null): AutoroadPlannerOptions {
  if (!projectId || typeof localStorage === 'undefined') {
    return { ...DEFAULT_AUTOROAD_PLANNER_OPTIONS };
  }
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT_AUTOROAD_PLANNER_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<AutoroadPlannerOptions>;
    return { ...DEFAULT_AUTOROAD_PLANNER_OPTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_AUTOROAD_PLANNER_OPTIONS };
  }
}

export function saveAutoroadPlannerOptions(
  projectId: string | null,
  options: AutoroadPlannerOptions,
): void {
  if (!projectId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(options));
  } catch {
    /* ignore quota */
  }
}

/** Map UI options to NetworkPlanRequest.options payload. */
export function plannerOptionsToRequestOptions(opts: AutoroadPlannerOptions) {
  return {
    solver: opts.solver,
    connector_max_km: opts.connector_max_km,
    enforce_attachment_radius: opts.enforce_attachment_radius,
    normalize_terminal_leaves: opts.normalize_terminal_leaves,
    steiner_hub_prefix: opts.steiner_hub_prefix,
    steiner_hub_offset_km: opts.steiner_hub_offset_km,
    edge_vertex_spacing_km: opts.edge_vertex_spacing_km,
    steiner_radius_km: opts.steiner_radius_km,
    attachment_angle_deg: opts.attachment_angle_deg,
    attachment_angle_penalty: opts.attachment_angle_penalty,
    max_terminals: 50,
  };
}

export type TerminalRole = 'start' | 'end' | 'intermediate';

export function terminalRoleForIndex(index: number, total: number): TerminalRole {
  if (total <= 1) return 'start';
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'intermediate';
}

export const TERMINAL_ROLE_LABELS: Record<TerminalRole, string> = {
  start: 'start',
  end: 'end',
  intermediate: 'промежуточный',
};
