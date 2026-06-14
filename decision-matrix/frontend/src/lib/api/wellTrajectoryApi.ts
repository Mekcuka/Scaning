import { request } from './client';
import type { ProjectJobCreateResponse } from './jobs';

/** Welleng design for many GS wells can exceed the default 12s API timeout. */
const WELL_TRAJECTORY_TIMEOUT_MS = 120_000;

export type WellTrajectoryStation = {
  md?: number;
  tvd?: number;
  n?: number;
  e?: number;
  inc?: number;
  azi?: number;
};

export type BottomholeTarget = {
  source?: string;
  plan?: { east_m: number; north_m: number };
  lon?: number;
  lat?: number;
  tvd_m: number;
  inc?: number;
  azi?: number;
};

export type WellTrajectory = {
  well_index: number;
  name?: string;
  survey?: { source?: string; stations?: WellTrajectoryStation[] };
  design?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
  target?: BottomholeTarget;
  clearance?: { min_sf: number; computed_at?: string };
};

export type ClearancePair = {
  well_a: number;
  well_a_pad_id?: string;
  well_a_pad_name?: string;
  well_b: number;
  well_b_pad_id?: string;
  well_b_pad_name?: string;
  min_sf: number;
  warning: boolean;
};

export type WellTrajectoryClearanceResponse = {
  pairs: ClearancePair[];
  computed_at: string;
  wells_count: number;
  pairs_count: number;
  threshold: number;
  warnings: string[];
};

export type WellTrajectoryLastResponse = {
  trajectories: WellTrajectory[];
  wells_local: { east_m: number; north_m: number }[];
  computed_at: string | null;
  clearance_pairs?: ClearancePair[];
  clearance_computed_at?: string | null;
  settings: {
    default_error_model: string;
    default_azi_reference: string;
    sf_warning_threshold: number;
    default_target_tvd_m?: number | null;
    units: string;
    step_m?: number;
    stub_tvd_m?: number;
    inc_heel?: number;
    gs_entry_search_step_m?: number;
  };
  warnings: string[];
};

export type WellTrajectoryGeoJsonFeature = {
  type: 'Feature';
  properties: {
    kind: string;
    well_index?: number;
    name?: string;
    infra_object_id?: string;
    pad_name?: string;
    tvd_m?: number;
    source?: string;
    min_sf?: number;
    sf_warning_threshold?: number;
  };
  geometry: { type: string; coordinates: unknown };
};

export type WellTrajectoryGeoJsonResponse = {
  type: 'FeatureCollection';
  features: WellTrajectoryGeoJsonFeature[];
};

export const wellTrajectoryApi = {
  getLast: (projectId: string, objectId: string) =>
    request<WellTrajectoryLastResponse>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/last`,
    ),

  getGeoJson: (projectId: string, objectId: string) =>
    request<WellTrajectoryGeoJsonResponse>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/geojson`,
    ),

  getProjectGeoJson: (projectId: string) =>
    request<WellTrajectoryGeoJsonResponse>(`/projects/${projectId}/well-trajectory/geojson`),

  generateFromLayout: (projectId: string, objectId: string) =>
    request<{ trajectories: WellTrajectory[]; computed_at?: string | null }>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/generate-from-layout`,
      { method: 'POST', timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  patchTargets: (
    projectId: string,
    objectId: string,
    targets: { well_index: number; target: BottomholeTarget }[],
  ) =>
    request<{ trajectories: WellTrajectory[] }>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/targets`,
      { method: 'PATCH', body: JSON.stringify({ targets }) },
    ),

  designAll: (projectId: string, objectId: string, body?: { step_m?: number; well_indices?: number[] }) =>
    request<{ designed: number[]; skipped: number[]; trajectories: WellTrajectory[] }>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/design-all`,
      { method: 'POST', body: JSON.stringify(body ?? {}), timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  syncBottomholes: (projectId: string, padObjectId: string) =>
    request<{ trajectories: WellTrajectory[]; warnings: string[] }>(
      `/projects/${projectId}/infrastructure/objects/${padObjectId}/well-trajectory/sync-bottomholes`,
      { method: 'POST', timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  designFromBottomholes: (
    projectId: string,
    padObjectId: string,
    body?: { step_m?: number; well_indices?: number[] },
  ) =>
    request<{
      designed: number[];
      skipped: number[];
      trajectories: WellTrajectory[];
      warnings: string[];
    }>(
      `/projects/${projectId}/infrastructure/objects/${padObjectId}/well-trajectory/design-from-bottomholes`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
        timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS,
      },
    ),

  compute: (projectId: string, objectId: string) =>
    request<{ trajectories: WellTrajectory[]; computed_at: string }>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/well-trajectory/compute`,
      { method: 'POST', timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  runProjectClearance: (projectId: string) =>
    request<WellTrajectoryClearanceResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/well-trajectory/clearance`,
      { method: 'POST', timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  runPadClearance: (projectId: string, padId: string) =>
    request<WellTrajectoryClearanceResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/clearance`,
      { method: 'POST', timeoutMs: WELL_TRAJECTORY_TIMEOUT_MS },
    ),

  previewSurveyImport: (projectId: string, padId: string, file: File, format: 'csv' | 'wbp') => {
    const fd = new FormData();
    fd.append('file', file);
    return request<WellTrajectoryImportPreviewResponse>(
      `/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/import/preview?format=${format}`,
      { method: 'POST', body: fd },
    );
  },

  importSurveyCsv: (
    projectId: string,
    padId: string,
    file: File,
    opts?: { async?: boolean; step_m?: number; interpolate?: boolean },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    const params = new URLSearchParams();
    if (opts?.async) params.set('async', 'true');
    if (opts?.step_m != null) params.set('step_m', String(opts.step_m));
    if (opts?.interpolate != null) params.set('interpolate', String(opts.interpolate));
    const qs = params.toString();
    return request<WellTrajectoryImportCommitResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/import/csv${qs ? `?${qs}` : ''}`,
      { method: 'POST', body: fd },
    );
  },

  importSurveyWbp: (
    projectId: string,
    padId: string,
    file: File,
    opts?: { async?: boolean; step_m?: number; interpolate?: boolean },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    const params = new URLSearchParams();
    if (opts?.async) params.set('async', 'true');
    if (opts?.step_m != null) params.set('step_m', String(opts.step_m));
    if (opts?.interpolate != null) params.set('interpolate', String(opts.interpolate));
    const qs = params.toString();
    return request<WellTrajectoryImportCommitResponse | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/objects/${padId}/well-trajectory/import/wbp${qs ? `?${qs}` : ''}`,
      { method: 'POST', body: fd },
    );
  },
};

export type WellTrajectoryImportPreviewWell = {
  name: string;
  station_count: number;
  matched_index: number | null;
  warnings: string[];
};

export type WellTrajectoryImportPreviewResponse = {
  wells: WellTrajectoryImportPreviewWell[];
  errors: string[];
  well_count: number;
  warnings: string[];
};

export type WellTrajectoryImportCommitResponse = {
  trajectories: WellTrajectory[];
  computed_at: string;
  warnings: string[];
  imported_count: number;
};
