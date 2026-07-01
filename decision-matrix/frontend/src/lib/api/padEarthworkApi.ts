import { unwrapApiJobResponse } from '../runApiJob';
import { request } from './client';
import type { InfraObject } from './entities';
import type { ProjectJobCreateResponse } from './jobs';

export type PadEarthworkParams = {
  length_m: number;
  width_m: number;
  height_m: number;
  rotation_deg?: number;
  reference_elevation_m: number;
};

export type PadHeightReference = {
  height_m: number;
  reference_elevation_m: number;
};

export type PlanRectangleSketch = {
  kind: 'plan_rectangle';
  length_m: number;
  width_m: number;
  rotation_deg: number;
};

export type PlanVertex = {
  east_m: number;
  north_m: number;
};

export type PlanPolygonSketch = {
  kind: 'plan_polygon';
  vertices: PlanVertex[];
};

export type PlanShapeSketch = PlanRectangleSketch | PlanPolygonSketch;

export type PadTerrainMode = { mode: 'flat' } | { mode: 'dem'; dem_asset_id?: string };

export type PadEarthworkVolumes = {
  fill_m3: number;
  cut_m3: number;
  net_fill_m3: number;
};

export type PadEarthworkComputeResult = {
  volumes: PadEarthworkVolumes;
  design: {
    top_elevation_m: number;
    footprint_area_m2: number;
  };
  footprint_corners: { lon: number; lat: number }[];
  mesh?: { format: 'glb'; base64: string } | null;
  warnings: string[];
  computed_at?: string | null;
};

export type SketchPreview = {
  length_m: number;
  width_m: number;
  rotation_deg: number;
  footprint_area_m2: number;
  footprint_corners_local: { east_m: number; north_m: number }[];
};

export type EnvelopeWrap = {
  enabled: boolean;
  wrap_width_m: number;
};

export type PadDemStatus = {
  asset_id: string | null;
  source: string | null;
  fetched_at: string | null;
};

export type PadDemFetchResult = {
  dem_asset_id: string;
  source: string;
  fetched_at: string;
  bbox: number[];
  reference_elevation_m: number;
};

export type PadDemPreviewBounds = {
  min_east_m: number;
  max_east_m: number;
  min_north_m: number;
  max_north_m: number;
};

export type PadDemPreview = {
  bounds: PadDemPreviewBounds;
  cols: number;
  rows: number;
  cell_size_m: number;
  elev_min: number;
  elev_max: number;
  footprint_elev_min: number;
  design_elevation_m: number;
  elevations: (number | null)[];
  cut_fill: (number | null)[];
};

export type PadEarthworkLast = {
  params: PadEarthworkParams | null;
  sketch?: PlanShapeSketch | null;
  wells_local?: PlanVertex[];
  envelope?: EnvelopeWrap | null;
  sketch_saved_at?: string | null;
  dem?: PadDemStatus | null;
  result: PadEarthworkComputeResult | null;
};

export type WellLayoutGenerateResult = {
  sketch: PlanPolygonSketch;
  wells_local: PlanVertex[];
  length_m: number;
  width_m: number;
  rotation_deg: number;
  footprint_area_m2: number;
};

export type WellLayoutGenerateBody = {
  well_count?: number;
  wells_per_group?: number;
  well_spacing_m?: number;
  group_spacing_m?: number;
  margins?: {
    left_m?: number;
    bottom_m?: number;
    top_m?: number;
    end_m?: number;
  };
  rotation_deg?: number;
};

export const padEarthworkApi = {
  compute: async (
    projectId: string,
    objectId: string,
    body?: {
      params?: PadEarthworkParams | PadHeightReference;
      sketch?: PlanShapeSketch;
      envelope?: EnvelopeWrap | null;
      terrain?: PadTerrainMode;
    },
  ) => {
    const res = await request<PadEarthworkComputeResult | ProjectJobCreateResponse>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/compute`,
      {
        method: 'POST',
        body: JSON.stringify({
          params: body?.params,
          sketch: body?.sketch,
          envelope: body?.envelope ?? undefined,
          terrain: body?.terrain ?? { mode: 'flat' },
        }),
      },
    );
    return unwrapApiJobResponse<PadEarthworkComputeResult>(projectId, res);
  },
  fetchDem: (
    projectId: string,
    objectId: string,
    body?: {
      params?: PadEarthworkParams | PadHeightReference;
      sketch?: PlanShapeSketch;
    },
  ) =>
    request<PadDemFetchResult>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/dem/fetch`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      },
    ),
  fetchDemPreview: (
    projectId: string,
    objectId: string,
    body?: {
      params?: PadEarthworkParams | PadHeightReference;
      sketch?: PlanShapeSketch;
    },
  ) =>
    request<PadDemPreview>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/dem/preview`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      },
    ),
  getLast: (projectId: string, objectId: string) =>
    request<PadEarthworkLast>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/last`,
    ),
  previewSketch: (projectId: string, sketch: PlanShapeSketch) =>
    request<SketchPreview>(`/projects/${projectId}/pad-earthwork/sketch/preview`, {
      method: 'POST',
      body: JSON.stringify({ sketch }),
    }),
  patchParams: (projectId: string, objectId: string, params: Partial<PadEarthworkParams>) =>
    request<InfraObject>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/params`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      },
    ),
  saveSketch: (
    projectId: string,
    objectId: string,
    body: {
      sketch: PlanShapeSketch;
      params?: PadHeightReference;
      envelope?: EnvelopeWrap | null;
      wells_local?: PlanVertex[];
      rotation_deg?: number;
    },
  ) =>
    request<InfraObject>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/sketch`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sketch: body.sketch,
          params: body.params,
          envelope: body.envelope ?? undefined,
          wells_local: body.wells_local?.length ? body.wells_local : undefined,
          rotation_deg: body.rotation_deg,
        }),
      },
    ),
  generateSketch: (projectId: string, objectId: string, body?: WellLayoutGenerateBody) =>
    request<WellLayoutGenerateResult>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/sketch/generate`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      },
    ),
};
