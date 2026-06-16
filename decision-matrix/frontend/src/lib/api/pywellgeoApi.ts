import { request } from './client';

export type PyWellGeoTreeNode = {
  x: number;
  y: number;
  z: number;
  radius: number;
  perforated: boolean;
  color: string;
  name: string;
  branches: PyWellGeoTreeNode[];
};

export type PyWellGeoTreeRecord = {
  well_index: number;
  name?: string | null;
  tree: PyWellGeoTreeNode;
  source?: string | null;
  geometry?: Record<string, unknown> | null;
  branch_stats?: Array<Record<string, unknown>> | null;
};

export type PyWellGeoSettings = {
  default_radius_m: number;
  tsurface_c: number;
  tgrad_c_per_m: number;
  yaml_format_default: 'XYZGENERIC' | 'DETAILEDTNO' | 'DC1D';
  coarsen_segment_length_m?: number;
};

export type PyWellGeoLastResponse = {
  settings: PyWellGeoSettings;
  trees: PyWellGeoTreeRecord[];
  computed_at: string | null;
  warnings: string[];
};

export type PyWellGeoPlotSegment = {
  from_xyz: number[];
  to_xyz: number[];
  color: string;
  perforated: boolean;
  name: string;
};

export type PyWellGeoPlotDataResponse = {
  segments: PyWellGeoPlotSegment[];
};

export const DEFAULT_PYWELLGEO_SETTINGS: PyWellGeoSettings = {
  default_radius_m: 0.10795,
  tsurface_c: 10,
  tgrad_c_per_m: 0.031,
  yaml_format_default: 'XYZGENERIC',
  coarsen_segment_length_m: 75,
};

const base = (projectId: string, padId: string) =>
  `/projects/${projectId}/infrastructure/objects/${padId}/pywellgeo`;

export const pywellgeoApi = {
  getLast(projectId: string, padId: string) {
    return request<PyWellGeoLastResponse>(`${base(projectId, padId)}/last`);
  },

  putTrees(projectId: string, padId: string, body: { settings?: PyWellGeoSettings; trees: PyWellGeoTreeRecord[] }) {
    return request<PyWellGeoLastResponse>(`${base(projectId, padId)}/trees`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  syncFromSurvey(projectId: string, padId: string, wellIndex: number, radiusM?: number) {
    return request<{ tree: PyWellGeoTreeRecord; warnings: string[] }>(
      `${base(projectId, padId)}/sync-from-survey`,
      {
        method: 'POST',
        body: JSON.stringify({ well_index: wellIndex, radius_m: radiusM ?? null }),
      },
    );
  },

  compute(
    projectId: string,
    padId: string,
    wellIndex: number,
    opts?: { tsurfaceC?: number; tgradCPerM?: number; tree?: PyWellGeoTreeNode },
  ) {
    return request<{ tree: PyWellGeoTreeRecord; temperature_profile: Array<{ depth_m: number; temp_c: number }> }>(
      `${base(projectId, padId)}/compute`,
      {
        method: 'POST',
        body: JSON.stringify({
          well_index: wellIndex,
          tsurface_c: opts?.tsurfaceC ?? null,
          tgrad_c_per_m: opts?.tgradCPerM ?? null,
          tree: opts?.tree ?? null,
        }),
      },
    );
  },

  plotData(projectId: string, padId: string, wellIndex: number, tree?: PyWellGeoTreeNode) {
    if (tree) {
      return request<PyWellGeoPlotDataResponse>(`${base(projectId, padId)}/plot-data`, {
        method: 'POST',
        body: JSON.stringify({ well_index: wellIndex, tree }),
      });
    }
    return request<PyWellGeoPlotDataResponse>(
      `${base(projectId, padId)}/plot-data?well_index=${wellIndex}`,
    );
  },

  applyToGeometry(projectId: string, padId: string, wellIndex: number, tree?: PyWellGeoTreeNode) {
    return request<{ well_index: number; geometry: Record<string, unknown> }>(
      `${base(projectId, padId)}/apply-to-geometry`,
      {
        method: 'POST',
        body: JSON.stringify({ well_index: wellIndex, tree: tree ?? null }),
      },
    );
  },

  addBranch(
    projectId: string,
    padId: string,
    body: {
      well_index: number;
      tree: PyWellGeoTreeNode;
      xyz?: number[][];
      name: string;
      color: string;
      radius_m?: number;
      design_with_welleng?: boolean;
      kickoff_xyz?: number[];
      bottomhole_ref?: string;
      step_m?: number;
      dls_design?: number;
    },
  ) {
    return request<{ tree: PyWellGeoTreeRecord; warnings: string[] }>(
      `${base(projectId, padId)}/tree/add-branch`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  coarsen(
    projectId: string,
    padId: string,
    body: { well_index: number; tree: PyWellGeoTreeNode; segment_length_m?: number },
  ) {
    return request<{ tree: PyWellGeoTreeRecord; node_count_before: number; node_count_after: number }>(
      `${base(projectId, padId)}/tree/coarsen`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  splitAtZ(
    projectId: string,
    padId: string,
    body: { well_index: number; tree: PyWellGeoTreeNode; z_m: number },
  ) {
    return request<{ tree: PyWellGeoTreeRecord }>(
      `${base(projectId, padId)}/tree/split-at-z`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  importYaml(
    projectId: string,
    padId: string,
    body: { content: string; format?: string; well_index?: number; well_key?: string | null },
  ) {
    return request<PyWellGeoTreeRecord>(`${base(projectId, padId)}/yaml/import`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  exportYaml(
    projectId: string,
    padId: string,
    wellIndex: number,
    format: string,
    wellName: string,
    tree?: PyWellGeoTreeNode,
  ) {
    return request<{ content: string; format: string }>(`${base(projectId, padId)}/yaml/export`, {
      method: 'POST',
      body: JSON.stringify({
        well_index: wellIndex,
        format,
        well_name: wellName,
        tree: tree ?? null,
      }),
    });
  },

  azimDipConvert(
    projectId: string,
    padId: string,
    body: {
      mode: 'vector_to_azim_dip' | 'azim_dip_to_vector' | 'azim_dip_to_normal';
      azim_deg?: number;
      dip_deg?: number;
      vector?: number[];
    },
  ) {
    return request<{
      azim_deg?: number;
      dip_deg?: number;
      vector?: number[];
      normal?: number[];
    }>(`${base(projectId, padId)}/azim-dip/convert`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  waterProperties(
    projectId: string,
    padId: string,
    body: {
      temperature_c?: number;
      pressure_pa?: number;
      depth_m?: number;
      salinity_ppm?: number;
      properties?: string[];
    },
  ) {
    return request<{ values: Record<string, number>; units: Record<string, string> }>(
      `${base(projectId, padId)}/water/properties`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  dc1dBuild(projectId: string, padId: string, body: Record<string, unknown>) {
    return request<PyWellGeoTreeRecord>(`${base(projectId, padId)}/dc1d/build`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  coordinateTransform(
    projectId: string,
    padId: string,
    body: {
      plane_azim_deg: number;
      plane_dip_deg: number;
      origin?: number[];
      pitch_deg?: number;
      points: number[][];
      direction?: 'global_to_local' | 'local_to_global';
    },
  ) {
    return request<{ points: number[][] }>(`${base(projectId, padId)}/coordinate/transform`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
