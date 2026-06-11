import { request } from './client';
import type { InfraObject } from './entities';

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

export type PadEarthworkLast = {
  params: PadEarthworkParams | null;
  sketch?: PlanShapeSketch | null;
  envelope?: EnvelopeWrap | null;
  sketch_saved_at?: string | null;
  result: PadEarthworkComputeResult | null;
};

export const padEarthworkApi = {
  compute: (
    projectId: string,
    objectId: string,
    body?: {
      params?: PadEarthworkParams | PadHeightReference;
      sketch?: PlanShapeSketch;
      envelope?: EnvelopeWrap | null;
    },
  ) =>
    request<PadEarthworkComputeResult>(
      `/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/compute`,
      {
        method: 'POST',
        body: JSON.stringify({
          params: body?.params,
          sketch: body?.sketch,
          envelope: body?.envelope ?? undefined,
          terrain: { mode: 'flat' },
        }),
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
    request(`/projects/${projectId}/infrastructure/objects/${objectId}/pad-earthwork/params`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    }),
  saveSketch: (
    projectId: string,
    objectId: string,
    body: {
      sketch: PlanShapeSketch;
      params?: PadHeightReference;
      envelope?: EnvelopeWrap | null;
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
        }),
      },
    ),
};
